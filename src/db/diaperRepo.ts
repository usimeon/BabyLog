import { DiaperLog, PoopSize } from '../types/models';
import { createId } from '../utils/id';
import { nowIso } from '../utils/time';
import { getAll, getOne, runSql } from './client';

export type DiaperInput = {
  timestamp: string;
  had_pee: number;
  had_poop: number;
  poop_size?: PoopSize | null;
  notes?: string | null;
};

export const addDiaperLog = async (babyId: string, input: DiaperInput) => {
  const now = nowIso();
  const id = createId('diaper');

  await runSql(
    `INSERT INTO diaper_logs(
      id, baby_id, timestamp, had_pee, had_poop, poop_size, notes, created_at, updated_at, deleted_at, dirty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1);`,
    [
      id,
      babyId,
      input.timestamp,
      input.had_pee,
      input.had_poop,
      input.had_poop ? input.poop_size ?? 'small' : null,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return getDiaperById(id);
};

export const updateDiaperLog = async (id: string, input: DiaperInput) => {
  const now = nowIso();
  await runSql(
    `UPDATE diaper_logs
     SET timestamp = ?, had_pee = ?, had_poop = ?, poop_size = ?, notes = ?, updated_at = ?, dirty = 1
     WHERE id = ?;`,
    [
      input.timestamp,
      input.had_pee,
      input.had_poop,
      input.had_poop ? input.poop_size ?? 'small' : null,
      input.notes ?? null,
      now,
      id,
    ],
  );

  return getDiaperById(id);
};

export const softDeleteDiaperLog = async (id: string) => {
  const now = nowIso();
  await runSql('UPDATE diaper_logs SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;', [now, now, id]);
};

export const getDiaperById = async (id: string) => {
  return getOne<DiaperLog>('SELECT * FROM diaper_logs WHERE id = ? LIMIT 1;', [id]);
};

export const listDiaperLogs = async (babyId: string) => {
  return getAll<DiaperLog>('SELECT * FROM diaper_logs WHERE baby_id = ? AND deleted_at IS NULL ORDER BY timestamp DESC;', [
    babyId,
  ]);
};

export const diaperRowsForRange = async (babyId: string, from: string, to: string) => {
  return getAll<DiaperLog>(
    `SELECT * FROM diaper_logs
     WHERE baby_id = ? AND deleted_at IS NULL AND timestamp BETWEEN ? AND ?
     ORDER BY timestamp ASC;`,
    [babyId, from, to],
  );
};
