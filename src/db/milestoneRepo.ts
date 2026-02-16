import { Milestone } from '../types/models';
import { createId } from '../utils/id';
import { nowIso } from '../utils/time';
import { getAll, getOne, runSql } from './client';

export type MilestoneInput = {
  timestamp: string;
  title: string;
  notes?: string | null;
  photo_uri?: string | null;
};

export const addMilestone = async (babyId: string, input: MilestoneInput) => {
  const now = nowIso();
  const id = createId('mile');

  await runSql(
    `INSERT INTO milestones(
      id, baby_id, timestamp, title, notes, photo_uri, created_at, updated_at, deleted_at, dirty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1);`,
    [id, babyId, input.timestamp, input.title, input.notes ?? null, input.photo_uri ?? null, now, now],
  );

  return getMilestoneById(id);
};

export const updateMilestone = async (id: string, input: MilestoneInput) => {
  const now = nowIso();

  await runSql(
    `UPDATE milestones
     SET timestamp = ?, title = ?, notes = ?, photo_uri = ?, updated_at = ?, dirty = 1
     WHERE id = ?;`,
    [input.timestamp, input.title, input.notes ?? null, input.photo_uri ?? null, now, id],
  );

  return getMilestoneById(id);
};

export const softDeleteMilestone = async (id: string) => {
  const now = nowIso();
  await runSql('UPDATE milestones SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;', [now, now, id]);
};

export const getMilestoneById = async (id: string) => {
  return getOne<Milestone>('SELECT * FROM milestones WHERE id = ? LIMIT 1;', [id]);
};

export const listMilestones = async (babyId: string) => {
  return getAll<Milestone>('SELECT * FROM milestones WHERE baby_id = ? AND deleted_at IS NULL ORDER BY timestamp DESC;', [
    babyId,
  ]);
};

export const milestoneRowsForRange = async (babyId: string, from: string, to: string) => {
  return getAll<Milestone>(
    `SELECT * FROM milestones
     WHERE baby_id = ? AND deleted_at IS NULL AND timestamp BETWEEN ? AND ?
     ORDER BY timestamp ASC;`,
    [babyId, from, to],
  );
};
