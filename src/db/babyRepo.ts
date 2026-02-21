import { BabyProfile } from '../types/models';
import { createId } from '../utils/id';
import { nowIso } from '../utils/time';
import { getAll, getOne, runSql } from './client';

export const getOrCreateDefaultBaby = async (): Promise<BabyProfile> => {
  const existing = await getOne<BabyProfile>(
    'SELECT * FROM babies WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1;',
  );

  if (existing) return existing;

  const now = nowIso();
  const baby: BabyProfile = {
    id: createId('baby'),
    name: 'My Baby',
    birthdate: null,
    photo_uri: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    dirty: 1,
  };

  await runSql(
    `INSERT INTO babies(id, name, birthdate, photo_uri, created_at, updated_at, deleted_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      baby.id,
      baby.name,
      baby.birthdate ?? null,
      baby.photo_uri ?? null,
      baby.created_at,
      baby.updated_at,
      baby.deleted_at ?? null,
      baby.dirty,
    ],
  );

  return baby;
};

export const upsertBaby = async (baby: BabyProfile, markDirty = false) => {
  await runSql(
    `INSERT INTO babies(id, name, birthdate, photo_uri, created_at, updated_at, deleted_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       birthdate = excluded.birthdate,
       photo_uri = excluded.photo_uri,
       updated_at = excluded.updated_at,
       deleted_at = excluded.deleted_at,
       dirty = CASE WHEN ? = 1 THEN 1 ELSE babies.dirty END;`,
    [
      baby.id,
      baby.name,
      baby.birthdate ?? null,
      baby.photo_uri ?? null,
      baby.created_at,
      baby.updated_at,
      baby.deleted_at ?? null,
      markDirty ? 1 : baby.dirty,
      markDirty ? 1 : 0,
    ],
  );
};

export const getBabyById = async (id: string) => {
  return getOne<BabyProfile>('SELECT * FROM babies WHERE id = ? LIMIT 1;', [id]);
};

export const listBabies = async () => {
  return getAll<BabyProfile>('SELECT * FROM babies WHERE deleted_at IS NULL ORDER BY created_at ASC;');
};

export const isBabyNameTaken = async (name: string, options?: { excludeBabyId?: string }) => {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;

  const excludeBabyId = options?.excludeBabyId;
  const row = excludeBabyId
    ? await getOne<{ count: number }>(
        `SELECT COUNT(*) as count
         FROM babies
         WHERE deleted_at IS NULL
           AND id != ?
           AND lower(trim(name)) = ?;`,
        [excludeBabyId, normalized],
      )
    : await getOne<{ count: number }>(
        `SELECT COUNT(*) as count
         FROM babies
         WHERE deleted_at IS NULL
           AND lower(trim(name)) = ?;`,
        [normalized],
      );

  return (row?.count ?? 0) > 0;
};

export const createBaby = async (input: { name: string; birthdate: string | null; photo_uri?: string | null }) => {
  const now = nowIso();
  const baby: BabyProfile = {
    id: createId('baby'),
    name: input.name.trim() || 'My Baby',
    birthdate: input.birthdate,
    photo_uri: input.photo_uri ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    dirty: 1,
  };

  await runSql(
    `INSERT INTO babies(id, name, birthdate, photo_uri, created_at, updated_at, deleted_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      baby.id,
      baby.name,
      baby.birthdate ?? null,
      baby.photo_uri ?? null,
      baby.created_at,
      baby.updated_at,
      baby.deleted_at ?? null,
      baby.dirty,
    ],
  );

  return baby;
};

export const softDeleteBaby = async (id: string) => {
  const now = nowIso();
  await runSql(
    `UPDATE babies
     SET deleted_at = ?, updated_at = ?, dirty = 1
     WHERE id = ?;`,
    [now, now, id],
  );

  const childTables = [
    'feed_events',
    'measurements',
    'temperature_logs',
    'diaper_logs',
    'medication_logs',
    'milestones',
  ];

  for (const table of childTables) {
    await runSql(
      `UPDATE ${table}
       SET deleted_at = ?, updated_at = ?, dirty = 1
       WHERE baby_id = ?
         AND deleted_at IS NULL;`,
      [now, now, id],
    );
  }
};
