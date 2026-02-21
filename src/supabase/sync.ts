import { supabase } from './client';
import { getCurrentSession } from './auth';
import { getAll, getOne, runSql, withTransaction } from '../db/client';
import {
  clearActiveBabyId,
  getAuthUserId,
  getLocalDataOwnerUserId,
  setAuthUserId,
  setLastSyncAt,
  setLocalDataOwnerUserId,
} from '../db/settingsRepo';
import { nowIso } from '../utils/time';

type SyncRow = {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

type RemoteBabyRow = {
  id: string;
  user_id: string;
  name: string;
  birthdate?: string | null;
  photo_uri?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

type SyncTable =
  | 'babies'
  | 'feed_events'
  | 'measurements'
  | 'temperature_logs'
  | 'diaper_logs'
  | 'medication_logs'
  | 'milestones';

type ChildTable = Exclude<SyncTable, 'babies'>;

type DirtyRows = {
  babies: any[];
  feed_events: any[];
  measurements: any[];
  temperature_logs: any[];
  diaper_logs: any[];
  medication_logs: any[];
  milestones: any[];
};

const CHILD_TABLES: ChildTable[] = [
  'feed_events',
  'measurements',
  'temperature_logs',
  'diaper_logs',
  'medication_logs',
  'milestones',
];

const CHUNK_SIZE = 300;
const MAX_SYNC_RETRIES = 3;

const sleep = async (ms: number) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const isRetryableError = (error: any) => {
  const status = Number(error?.status ?? error?.code);
  if (Number.isFinite(status)) {
    if ([408, 409, 425, 429].includes(status)) return true;
    if (status >= 500 && status <= 599) return true;
  }

  const message = String(error?.message ?? '').toLowerCase();
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('temporar') ||
    message.includes('fetch') ||
    message.includes('connection')
  );
};

const withRetry = async <T>(label: string, operation: () => Promise<T>) => {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < MAX_SYNC_RETRIES) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= MAX_SYNC_RETRIES || !isRetryableError(error)) {
        throw error;
      }
      console.log(`[sync] retry ${label} attempt ${attempt + 1}`);
      await sleep(250 * 2 ** (attempt - 1));
    }
  }

  throw lastError;
};

const chunk = <T>(items: T[], size: number): T[][] => {
  if (items.length <= size) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const upsertInChunks = async (table: string, rows: any[]) => {
  if (!supabase || !rows.length) return;
  const chunks = chunk(rows, CHUNK_SIZE);
  for (const batch of chunks) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
    if (error) throw error;
  }
};

const markClean = async (table: SyncTable, ids: string[]) => {
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  await runSql(`UPDATE ${table} SET dirty = 0 WHERE id IN (${placeholders});`, ids);
};

const readDirtyRows = async (): Promise<DirtyRows> => {
  const [
    babies,
    feedEvents,
    measurements,
    temperatures,
    diapers,
    medications,
    milestones,
  ] = await Promise.all([
    getAll<any>('SELECT * FROM babies WHERE dirty = 1;'),
    getAll<any>('SELECT * FROM feed_events WHERE dirty = 1;'),
    getAll<any>('SELECT * FROM measurements WHERE dirty = 1;'),
    getAll<any>('SELECT * FROM temperature_logs WHERE dirty = 1;'),
    getAll<any>('SELECT * FROM diaper_logs WHERE dirty = 1;'),
    getAll<any>('SELECT * FROM medication_logs WHERE dirty = 1;'),
    getAll<any>('SELECT * FROM milestones WHERE dirty = 1;'),
  ]);

  return {
    babies,
    feed_events: feedEvents,
    measurements,
    temperature_logs: temperatures,
    diaper_logs: diapers,
    medication_logs: medications,
    milestones,
  };
};

const pruneOrphanedDirtyRows = async () => {
  for (const table of CHILD_TABLES) {
    await runSql(
      `DELETE FROM ${table}
       WHERE dirty = 1
         AND (
           baby_id IS NULL
           OR trim(baby_id) = ''
           OR baby_id NOT IN (SELECT id FROM babies)
         );`,
    );
  }
};

const removeLocalPlaceholderBabies = async (remoteBabies: RemoteBabyRow[]) => {
  if (!remoteBabies.length) return;

  const remoteIds = new Set(remoteBabies.map((x) => x.id));
  const localBabies = await getAll<any>('SELECT * FROM babies WHERE deleted_at IS NULL;');

  for (const baby of localBabies) {
    if (remoteIds.has(baby.id)) continue;
    if (baby.dirty !== 1) continue;

    const [feedCount, measurementCount, tempCount, diaperCount, medicationCount, milestoneCount] = await Promise.all([
      getOne<{ count: number }>('SELECT COUNT(*) as count FROM feed_events WHERE baby_id = ? AND deleted_at IS NULL;', [
        baby.id,
      ]),
      getOne<{ count: number }>('SELECT COUNT(*) as count FROM measurements WHERE baby_id = ? AND deleted_at IS NULL;', [
        baby.id,
      ]),
      getOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM temperature_logs WHERE baby_id = ? AND deleted_at IS NULL;',
        [baby.id],
      ),
      getOne<{ count: number }>('SELECT COUNT(*) as count FROM diaper_logs WHERE baby_id = ? AND deleted_at IS NULL;', [
        baby.id,
      ]),
      getOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM medication_logs WHERE baby_id = ? AND deleted_at IS NULL;',
        [baby.id],
      ),
      getOne<{ count: number }>('SELECT COUNT(*) as count FROM milestones WHERE baby_id = ? AND deleted_at IS NULL;', [
        baby.id,
      ]),
    ]);

    const hasData =
      (feedCount?.count ?? 0) > 0 ||
      (measurementCount?.count ?? 0) > 0 ||
      (tempCount?.count ?? 0) > 0 ||
      (diaperCount?.count ?? 0) > 0 ||
      (medicationCount?.count ?? 0) > 0 ||
      (milestoneCount?.count ?? 0) > 0;

    if (!hasData) {
      await runSql('DELETE FROM babies WHERE id = ?;', [baby.id]);
      console.log(`[sync] removed local placeholder baby id=${baby.id}`);
    }
  }
};

const dropDirtyRowsForMissingBabies = async (babyIds: string[]) => {
  if (!babyIds.length) return;
  const placeholders = babyIds.map(() => '?').join(',');

  for (const table of CHILD_TABLES) {
    await runSql(
      `DELETE FROM ${table}
       WHERE dirty = 1
         AND baby_id IN (${placeholders});`,
      babyIds,
    );
  }
};

const pushDirtyRows = async (userId: string) => {
  if (!supabase) return;

  await pruneOrphanedDirtyRows();

  let dirty = await readDirtyRows();

  console.log(
    `[sync] pushing dirty rows babies=${dirty.babies.length} feeds=${dirty.feed_events.length} measurements=${dirty.measurements.length} temps=${dirty.temperature_logs.length} diapers=${dirty.diaper_logs.length} meds=${dirty.medication_logs.length} milestones=${dirty.milestones.length}`,
  );

  const referencedBabyIds = Array.from(
    new Set(
      [
        ...dirty.feed_events.map((row) => row.baby_id),
        ...dirty.measurements.map((row) => row.baby_id),
        ...dirty.temperature_logs.map((row) => row.baby_id),
        ...dirty.diaper_logs.map((row) => row.baby_id),
        ...dirty.medication_logs.map((row) => row.baby_id),
        ...dirty.milestones.map((row) => row.baby_id),
      ].filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
    ),
  );

  if (referencedBabyIds.length) {
    const placeholders = referencedBabyIds.map(() => '?').join(',');
    const referencedBabies = await getAll<any>(`SELECT * FROM babies WHERE id IN (${placeholders});`, referencedBabyIds);
    const foundIds = new Set(referencedBabies.map((row) => row.id as string));
    const missingIds = referencedBabyIds.filter((id) => !foundIds.has(id));

    if (missingIds.length) {
      await dropDirtyRowsForMissingBabies(missingIds);
      dirty = await readDirtyRows();
    }

    if (referencedBabies.length) {
      const payload = referencedBabies.map((row) => ({
        id: row.id,
        user_id: userId,
        name: row.name,
        birthdate: row.birthdate,
        photo_uri: row.photo_uri ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
      }));

      await upsertInChunks('babies', payload);
    }
  }

  if (dirty.babies.length) {
    const payload = dirty.babies.map((row) => ({
      id: row.id,
      user_id: userId,
      name: row.name,
      birthdate: row.birthdate,
      photo_uri: row.photo_uri ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    }));

    await upsertInChunks('babies', payload);
    await markClean('babies', dirty.babies.map((x) => x.id));
  }

  if (dirty.feed_events.length) {
    const payload = dirty.feed_events.map((row) => ({
      id: row.id,
      user_id: userId,
      baby_id: row.baby_id,
      timestamp: row.timestamp,
      type: row.type,
      amount_ml: row.amount_ml,
      duration_minutes: row.duration_minutes,
      side: row.side,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    }));

    await upsertInChunks('feed_events', payload);
    await markClean('feed_events', dirty.feed_events.map((x) => x.id));
  }

  if (dirty.measurements.length) {
    const payload = dirty.measurements.map((row) => ({
      id: row.id,
      user_id: userId,
      baby_id: row.baby_id,
      timestamp: row.timestamp,
      weight_kg: row.weight_kg,
      length_cm: row.length_cm,
      head_circumference_cm: row.head_circumference_cm,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    }));

    await upsertInChunks('measurements', payload);
    await markClean('measurements', dirty.measurements.map((x) => x.id));
  }

  if (dirty.temperature_logs.length) {
    const payload = dirty.temperature_logs.map((row) => ({
      id: row.id,
      user_id: userId,
      baby_id: row.baby_id,
      timestamp: row.timestamp,
      temperature_c: row.temperature_c,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    }));

    await upsertInChunks('temperature_logs', payload);
    await markClean('temperature_logs', dirty.temperature_logs.map((x) => x.id));
  }

  if (dirty.diaper_logs.length) {
    const payload = dirty.diaper_logs.map((row) => ({
      id: row.id,
      user_id: userId,
      baby_id: row.baby_id,
      timestamp: row.timestamp,
      had_pee: Boolean(row.had_pee),
      had_poop: Boolean(row.had_poop),
      poop_size: row.poop_size,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    }));

    await upsertInChunks('diaper_logs', payload);
    await markClean('diaper_logs', dirty.diaper_logs.map((x) => x.id));
  }

  if (dirty.medication_logs.length) {
    const payload = dirty.medication_logs.map((row) => ({
      id: row.id,
      user_id: userId,
      baby_id: row.baby_id,
      timestamp: row.timestamp,
      medication_name: row.medication_name,
      dose_value: row.dose_value,
      dose_unit: row.dose_unit,
      min_interval_hours: row.min_interval_hours,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    }));

    await upsertInChunks('medication_logs', payload);
    await markClean('medication_logs', dirty.medication_logs.map((x) => x.id));
  }

  if (dirty.milestones.length) {
    const payload = dirty.milestones.map((row) => ({
      id: row.id,
      user_id: userId,
      baby_id: row.baby_id,
      timestamp: row.timestamp,
      title: row.title,
      notes: row.notes,
      photo_uri: row.photo_uri,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    }));

    await upsertInChunks('milestones', payload);
    await markClean('milestones', dirty.milestones.map((x) => x.id));
  }
};

const toMs = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

const shouldApplyRemote = (localUpdatedAt?: string | null, remoteUpdatedAt?: string | null) => {
  const localMs = toMs(localUpdatedAt);
  const remoteMs = toMs(remoteUpdatedAt);
  if (localMs === null) return true;
  if (remoteMs === null) return false;
  return localMs < remoteMs;
};

const applyRemoteRow = async (table: SyncTable, row: any) => {
  if (!row?.id) return;

  const local = await getOne<SyncRow>(`SELECT id, updated_at FROM ${table} WHERE id = ? LIMIT 1;`, [row.id]);
  if (local && !shouldApplyRemote(local.updated_at, row.updated_at)) {
    return;
  }

  if (table === 'babies') {
    await runSql(
      `INSERT INTO babies(id, name, birthdate, photo_uri, created_at, updated_at, deleted_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         birthdate = excluded.birthdate,
         photo_uri = excluded.photo_uri,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at,
         dirty = 0;`,
      [row.id, row.name, row.birthdate, row.photo_uri ?? null, row.created_at, row.updated_at, row.deleted_at],
    );
    return;
  }

  if (!row.baby_id) return;

  if (table === 'feed_events') {
    await runSql(
      `INSERT INTO feed_events(
        id, baby_id, timestamp, type, amount_ml, duration_minutes, side, notes,
        created_at, updated_at, deleted_at, dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        baby_id = excluded.baby_id,
        timestamp = excluded.timestamp,
        type = excluded.type,
        amount_ml = excluded.amount_ml,
        duration_minutes = excluded.duration_minutes,
        side = excluded.side,
        notes = excluded.notes,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        dirty = 0;`,
      [
        row.id,
        row.baby_id,
        row.timestamp,
        row.type,
        row.amount_ml,
        row.duration_minutes,
        row.side,
        row.notes,
        row.created_at,
        row.updated_at,
        row.deleted_at,
      ],
    );
    return;
  }

  if (table === 'measurements') {
    await runSql(
      `INSERT INTO measurements(
        id, baby_id, timestamp, weight_kg, length_cm, head_circumference_cm, notes,
        created_at, updated_at, deleted_at, dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        baby_id = excluded.baby_id,
        timestamp = excluded.timestamp,
        weight_kg = excluded.weight_kg,
        length_cm = excluded.length_cm,
        head_circumference_cm = excluded.head_circumference_cm,
        notes = excluded.notes,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        dirty = 0;`,
      [
        row.id,
        row.baby_id,
        row.timestamp,
        row.weight_kg,
        row.length_cm,
        row.head_circumference_cm,
        row.notes,
        row.created_at,
        row.updated_at,
        row.deleted_at,
      ],
    );
    return;
  }

  if (table === 'temperature_logs') {
    await runSql(
      `INSERT INTO temperature_logs(
        id, baby_id, timestamp, temperature_c, notes,
        created_at, updated_at, deleted_at, dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        baby_id = excluded.baby_id,
        timestamp = excluded.timestamp,
        temperature_c = excluded.temperature_c,
        notes = excluded.notes,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        dirty = 0;`,
      [
        row.id,
        row.baby_id,
        row.timestamp,
        row.temperature_c,
        row.notes,
        row.created_at,
        row.updated_at,
        row.deleted_at,
      ],
    );
    return;
  }

  if (table === 'medication_logs') {
    await runSql(
      `INSERT INTO medication_logs(
        id, baby_id, timestamp, medication_name, dose_value, dose_unit, min_interval_hours, notes,
        created_at, updated_at, deleted_at, dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        baby_id = excluded.baby_id,
        timestamp = excluded.timestamp,
        medication_name = excluded.medication_name,
        dose_value = excluded.dose_value,
        dose_unit = excluded.dose_unit,
        min_interval_hours = excluded.min_interval_hours,
        notes = excluded.notes,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        dirty = 0;`,
      [
        row.id,
        row.baby_id,
        row.timestamp,
        row.medication_name,
        row.dose_value,
        row.dose_unit,
        row.min_interval_hours,
        row.notes,
        row.created_at,
        row.updated_at,
        row.deleted_at,
      ],
    );
    return;
  }

  if (table === 'milestones') {
    await runSql(
      `INSERT INTO milestones(
        id, baby_id, timestamp, title, notes, photo_uri,
        created_at, updated_at, deleted_at, dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        baby_id = excluded.baby_id,
        timestamp = excluded.timestamp,
        title = excluded.title,
        notes = excluded.notes,
        photo_uri = excluded.photo_uri,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        dirty = 0;`,
      [
        row.id,
        row.baby_id,
        row.timestamp,
        row.title,
        row.notes,
        row.photo_uri,
        row.created_at,
        row.updated_at,
        row.deleted_at,
      ],
    );
    return;
  }

  await runSql(
    `INSERT INTO diaper_logs(
      id, baby_id, timestamp, had_pee, had_poop, poop_size, notes,
      created_at, updated_at, deleted_at, dirty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(id) DO UPDATE SET
      baby_id = excluded.baby_id,
      timestamp = excluded.timestamp,
      had_pee = excluded.had_pee,
      had_poop = excluded.had_poop,
      poop_size = excluded.poop_size,
      notes = excluded.notes,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      dirty = 0;`,
    [
      row.id,
      row.baby_id,
      row.timestamp,
      row.had_pee ? 1 : 0,
      row.had_poop ? 1 : 0,
      row.poop_size,
      row.notes,
      row.created_at,
      row.updated_at,
      row.deleted_at,
    ],
  );
};

const pullRemoteRows = async (userId: string) => {
  if (!supabase) return;

  const [
    { data: babies, error: babyErr },
    { data: feeds, error: feedErr },
    { data: measurements, error: measurementErr },
    { data: temperatures, error: tempErr },
    { data: diapers, error: diaperErr },
    { data: medications, error: medicationErr },
    { data: milestones, error: milestoneErr },
  ] = await Promise.all([
    supabase.from('babies').select('*').eq('user_id', userId),
    supabase.from('feed_events').select('*').eq('user_id', userId),
    supabase.from('measurements').select('*').eq('user_id', userId),
    supabase.from('temperature_logs').select('*').eq('user_id', userId),
    supabase.from('diaper_logs').select('*').eq('user_id', userId),
    supabase.from('medication_logs').select('*').eq('user_id', userId),
    supabase.from('milestones').select('*').eq('user_id', userId),
  ]);

  if (babyErr) throw babyErr;
  if (feedErr) throw feedErr;
  if (measurementErr) throw measurementErr;
  if (tempErr) throw tempErr;
  if (diaperErr) throw diaperErr;
  if (medicationErr) throw medicationErr;
  if (milestoneErr) throw milestoneErr;

  const remoteBabies = babies ?? [];
  const remoteFeeds = feeds ?? [];
  const remoteMeasurements = measurements ?? [];
  const remoteTemps = temperatures ?? [];
  const remoteDiapers = diapers ?? [];
  const remoteMeds = medications ?? [];
  const remoteMilestones = milestones ?? [];

  console.log(
    `[sync] pulling remote rows babies=${remoteBabies.length} feeds=${remoteFeeds.length} measurements=${remoteMeasurements.length} temps=${remoteTemps.length} diapers=${remoteDiapers.length} meds=${remoteMeds.length} milestones=${remoteMilestones.length}`,
  );

  await withTransaction(async () => {
    for (const baby of remoteBabies) {
      await applyRemoteRow('babies', baby);
    }

    const validBabyIds = new Set(remoteBabies.map((baby) => baby.id));

    for (const feed of remoteFeeds) {
      if (!validBabyIds.has(feed.baby_id)) continue;
      await applyRemoteRow('feed_events', feed);
    }
    for (const measurement of remoteMeasurements) {
      if (!validBabyIds.has(measurement.baby_id)) continue;
      await applyRemoteRow('measurements', measurement);
    }
    for (const temp of remoteTemps) {
      if (!validBabyIds.has(temp.baby_id)) continue;
      await applyRemoteRow('temperature_logs', temp);
    }
    for (const diaper of remoteDiapers) {
      if (!validBabyIds.has(diaper.baby_id)) continue;
      await applyRemoteRow('diaper_logs', diaper);
    }
    for (const medication of remoteMeds) {
      if (!validBabyIds.has(medication.baby_id)) continue;
      await applyRemoteRow('medication_logs', medication);
    }
    for (const milestone of remoteMilestones) {
      if (!validBabyIds.has(milestone.baby_id)) continue;
      await applyRemoteRow('milestones', milestone);
    }
  });
};

const fetchRemoteBabies = async (userId: string): Promise<RemoteBabyRow[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('babies')
    .select('id,user_id,name,birthdate,photo_uri,created_at,updated_at,deleted_at')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as RemoteBabyRow[];
};

const resetLocalDataForUserSwitch = async () => {
  await withTransaction(async () => {
    for (const table of CHILD_TABLES) {
      await runSql(`DELETE FROM ${table};`);
    }
    await runSql('DELETE FROM babies;');
  });

  await clearActiveBabyId();
  await setLastSyncAt(null);
};

const ensureLocalDataOwner = async (userId: string) => {
  const [owner, previousAuthUserId] = await Promise.all([getLocalDataOwnerUserId(), getAuthUserId()]);
  const discoveredOwner = owner ?? previousAuthUserId;

  if (discoveredOwner && discoveredOwner !== userId) {
    console.log(`[sync] local data owner changed ${discoveredOwner} -> ${userId}, resetting local sync tables`);
    await resetLocalDataForUserSwitch();
  }

  if (discoveredOwner !== userId) {
    await setLocalDataOwnerUserId(userId);
  }
};

const runSync = async () => {
  if (!supabase) return;

  const session = await getCurrentSession();
  if (!session?.user?.id) return;

  const userId = session.user.id;
  console.log('[sync] start');

  await ensureLocalDataOwner(userId);
  await setAuthUserId(userId);

  const remoteBabies = await withRetry('fetch remote babies', () => fetchRemoteBabies(userId));
  await removeLocalPlaceholderBabies(remoteBabies);

  await withRetry('push dirty rows', () => pushDirtyRows(userId));
  await withRetry('pull remote rows', () => pullRemoteRows(userId));

  await setLocalDataOwnerUserId(userId);
  await setLastSyncAt(nowIso());
  console.log('[sync] complete');
};

let syncPromise: Promise<void> | null = null;

export const syncAll = async () => {
  if (!supabase) return;
  if (syncPromise) return syncPromise;

  syncPromise = runSync().finally(() => {
    syncPromise = null;
  });

  return syncPromise;
};
