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
    created_at: now,
    updated_at: now,
    deleted_at: null,
    dirty: 1,
  };

  await runSql(
    `INSERT INTO babies(id, name, birthdate, created_at, updated_at, deleted_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      baby.id,
      baby.name,
      baby.birthdate ?? null,
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
    `INSERT INTO babies(id, name, birthdate, created_at, updated_at, deleted_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       birthdate = excluded.birthdate,
       updated_at = excluded.updated_at,
       deleted_at = excluded.deleted_at,
       dirty = CASE WHEN ? = 1 THEN 1 ELSE babies.dirty END;`,
    [
      baby.id,
      baby.name,
      baby.birthdate ?? null,
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

export const createBaby = async (input: { name: string; birthdate: string | null }) => {
  const now = nowIso();
  const baby: BabyProfile = {
    id: createId('baby'),
    name: input.name.trim() || 'My Baby',
    birthdate: input.birthdate,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    dirty: 1,
  };

  await runSql(
    `INSERT INTO babies(id, name, birthdate, created_at, updated_at, deleted_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      baby.id,
      baby.name,
      baby.birthdate ?? null,
      baby.created_at,
      baby.updated_at,
      baby.deleted_at ?? null,
      baby.dirty,
    ],
  );

  return baby;
};
