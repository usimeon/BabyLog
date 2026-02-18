import { supabase } from './client';
import { getCurrentSession } from './auth';
import { getAll, getOne, runSql } from '../db/client';
import { getOrCreateDefaultBaby } from '../db/babyRepo';
import { nowIso } from '../utils/time';
import { setAuthUserId, setLastSyncAt } from '../db/settingsRepo';

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

const markClean = async (table: SyncTable, ids: string[]) => {
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  await runSql(`UPDATE ${table} SET dirty = 0 WHERE id IN (${placeholders});`, ids);
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

    // A reinstall can create a blank local baby before first pull; drop that placeholder to avoid duplicate babies.
    if (!hasData) {
      await runSql('DELETE FROM babies WHERE id = ?;', [baby.id]);
      console.log(`[sync] removed local placeholder baby id=${baby.id}`);
    }
  }
};

const pushDirtyRows = async (userId: string) => {
  if (!supabase) return;

  const dirtyBabies = await getAll<any>('SELECT * FROM babies WHERE dirty = 1;');
  const dirtyFeeds = await getAll<any>('SELECT * FROM feed_events WHERE dirty = 1;');
  const dirtyMeasurements = await getAll<any>('SELECT * FROM measurements WHERE dirty = 1;');
  const dirtyTemperatures = await getAll<any>('SELECT * FROM temperature_logs WHERE dirty = 1;');
  const dirtyDiapers = await getAll<any>('SELECT * FROM diaper_logs WHERE dirty = 1;');
  const dirtyMedications = await getAll<any>('SELECT * FROM medication_logs WHERE dirty = 1;');
  const dirtyMilestones = await getAll<any>('SELECT * FROM milestones WHERE dirty = 1;');

  console.log(
    `[sync] pushing dirty rows babies=${dirtyBabies.length} feeds=${dirtyFeeds.length} measurements=${dirtyMeasurements.length} temps=${dirtyTemperatures.length} diapers=${dirtyDiapers.length} meds=${dirtyMedications.length} milestones=${dirtyMilestones.length}`,
  );

  // Ensure remote babies exist for all dirty child rows, even when those baby rows
  // are not currently marked dirty locally (e.g. after account switches or restores).
  const referencedBabyIds = Array.from(
    new Set(
      [
        ...dirtyFeeds.map((row) => row.baby_id),
        ...dirtyMeasurements.map((row) => row.baby_id),
        ...dirtyTemperatures.map((row) => row.baby_id),
        ...dirtyDiapers.map((row) => row.baby_id),
        ...dirtyMedications.map((row) => row.baby_id),
        ...dirtyMilestones.map((row) => row.baby_id),
      ].filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
    ),
  );

  if (referencedBabyIds.length) {
    const placeholders = referencedBabyIds.map(() => '?').join(',');
    const referencedBabies = await getAll<any>(
      `SELECT * FROM babies WHERE id IN (${placeholders}) AND deleted_at IS NULL;`,
      referencedBabyIds,
    );

    if (referencedBabies.length) {
      const payload = referencedBabies.map((row) => ({
        id: row.id,
        user_id: userId,
        name: row.name,
        birthdate: row.birthdate,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
      }));

      const { error } = await supabase.from('babies').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
    }
  }

  if (dirtyBabies.length) {
    const payload = dirtyBabies.map((row) => ({
      id: row.id,
      user_id: userId,
      name: row.name,
      birthdate: row.birthdate,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    }));

    const { error } = await supabase.from('babies').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    await markClean('babies', dirtyBabies.map((x) => x.id));
  }

  if (dirtyFeeds.length) {
    const payload = dirtyFeeds.map((row) => ({
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

    const { error } = await supabase.from('feed_events').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    await markClean('feed_events', dirtyFeeds.map((x) => x.id));
  }

  if (dirtyMeasurements.length) {
    const payload = dirtyMeasurements.map((row) => ({
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

    const { error } = await supabase.from('measurements').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    await markClean('measurements', dirtyMeasurements.map((x) => x.id));
  }

  if (dirtyTemperatures.length) {
    const payload = dirtyTemperatures.map((row) => ({
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

    const { error } = await supabase.from('temperature_logs').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    await markClean('temperature_logs', dirtyTemperatures.map((x) => x.id));
  }

  if (dirtyDiapers.length) {
    const payload = dirtyDiapers.map((row) => ({
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

    const { error } = await supabase.from('diaper_logs').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    await markClean('diaper_logs', dirtyDiapers.map((x) => x.id));
  }

  if (dirtyMedications.length) {
    const payload = dirtyMedications.map((row) => ({
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

    const { error } = await supabase.from('medication_logs').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    await markClean('medication_logs', dirtyMedications.map((x) => x.id));
  }

  if (dirtyMilestones.length) {
    const payload = dirtyMilestones.map((row) => ({
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

    const { error } = await supabase.from('milestones').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    await markClean('milestones', dirtyMilestones.map((x) => x.id));
  }
};

const applyRemoteRow = async (table: SyncTable, row: any) => {
  const local = await getOne<SyncRow>(`SELECT id, updated_at FROM ${table} WHERE id = ? LIMIT 1;`, [row.id]);
  if (local && new Date(local.updated_at).getTime() >= new Date(row.updated_at).getTime()) {
    return;
  }

  if (table === 'babies') {
    await runSql(
      `INSERT INTO babies(id, name, birthdate, created_at, updated_at, deleted_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         birthdate = excluded.birthdate,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at,
         dirty = 0;`,
      [row.id, row.name, row.birthdate, row.created_at, row.updated_at, row.deleted_at],
    );
    return;
  }

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

  console.log(
    `[sync] pulling remote rows babies=${babies.length} feeds=${feeds.length} measurements=${measurements.length} temps=${temperatures.length} diapers=${diapers.length} meds=${medications.length} milestones=${milestones.length}`,
  );

  for (const baby of babies) await applyRemoteRow('babies', baby);
  for (const feed of feeds) await applyRemoteRow('feed_events', feed);
  for (const measurement of measurements) await applyRemoteRow('measurements', measurement);
  for (const temp of temperatures) await applyRemoteRow('temperature_logs', temp);
  for (const diaper of diapers) await applyRemoteRow('diaper_logs', diaper);
  for (const medication of medications) await applyRemoteRow('medication_logs', medication);
  for (const milestone of milestones) await applyRemoteRow('milestones', milestone);
};

const fetchRemoteBabies = async (userId: string): Promise<RemoteBabyRow[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('babies')
    .select('id,user_id,name,birthdate,created_at,updated_at,deleted_at')
    .eq('user_id', userId);
  if (error) throw error;
  return data as RemoteBabyRow[];
};

const ensureRemoteHasBaby = async (userId: string, remoteBabies: RemoteBabyRow[]) => {
  if (!supabase) return;
  if (remoteBabies.length) return;
  const baby = await getOrCreateDefaultBaby();

  const { error: insertErr } = await supabase.from('babies').insert({
    id: baby.id,
    user_id: userId,
    name: baby.name,
    birthdate: baby.birthdate,
    created_at: baby.created_at,
    updated_at: baby.updated_at,
    deleted_at: baby.deleted_at,
  });
  if (insertErr) throw insertErr;
  await runSql('UPDATE babies SET dirty = 0 WHERE id = ?;', [baby.id]);
};

let syncInProgress = false;

export const syncAll = async () => {
  if (!supabase || syncInProgress) return;

  const session = await getCurrentSession();
  if (!session?.user?.id) return;

  syncInProgress = true;

  try {
    const userId = session.user.id;
    console.log('[sync] start');
    await setAuthUserId(userId);
    const remoteBabies = await fetchRemoteBabies(userId);
    await removeLocalPlaceholderBabies(remoteBabies);
    await ensureRemoteHasBaby(userId, remoteBabies);
    await pushDirtyRows(userId);
    await pullRemoteRows(userId);
    await setLastSyncAt(nowIso());
    console.log('[sync] complete');
  } finally {
    syncInProgress = false;
  }
};
