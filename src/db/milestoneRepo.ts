import { Milestone } from '../types/models';
import { createId } from '../utils/id';
import { nowIso } from '../utils/time';
import { getAll, getOne, runSql } from './client';
import {
  assertNoDuplicateRow,
  ensureBabyExists,
  ensureRecordForUpdate,
  normalizeIsoTimestamp,
  normalizeOptionalText,
  normalizeRequiredText,
} from './repoValidation';

export type MilestoneInput = {
  timestamp: string;
  title: string;
  notes?: string | null;
  photo_uri?: string | null;
};

const normalizeMilestoneInput = (input: MilestoneInput): MilestoneInput => ({
  timestamp: normalizeIsoTimestamp(input.timestamp),
  title: normalizeRequiredText(input.title, 'Milestone title', 160),
  notes: normalizeOptionalText(input.notes, 'Milestone notes', 2000),
  photo_uri: normalizeOptionalText(input.photo_uri, 'Photo URI', 2000),
});

const assertNoDuplicateMilestone = async (babyId: string, input: MilestoneInput, excludeId?: string) => {
  await assertNoDuplicateRow({
    table: 'milestones',
    babyId,
    timestamp: input.timestamp,
    columns: [{ column: 'title', value: input.title }],
    excludeId,
    message: 'A similar milestone entry already exists for this timestamp.',
  });
};

export const addMilestone = async (babyId: string, input: MilestoneInput) => {
  const normalizedBabyId = await ensureBabyExists(babyId);
  const payload = normalizeMilestoneInput(input);
  await assertNoDuplicateMilestone(normalizedBabyId, payload);

  const now = nowIso();
  const id = createId('mile');

  await runSql(
    `INSERT INTO milestones(
      id, baby_id, timestamp, title, notes, photo_uri, created_at, updated_at, deleted_at, dirty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1);`,
    [
      id,
      normalizedBabyId,
      payload.timestamp,
      payload.title,
      payload.notes ?? null,
      payload.photo_uri ?? null,
      now,
      now,
    ],
  );

  return getMilestoneById(id);
};

export const updateMilestone = async (id: string, input: MilestoneInput) => {
  const existing = await ensureRecordForUpdate('milestones', id, ['id', 'baby_id', 'deleted_at']);
  const payload = normalizeMilestoneInput(input);
  await assertNoDuplicateMilestone(existing.baby_id, payload, existing.id);

  const now = nowIso();

  await runSql(
    `UPDATE milestones
     SET timestamp = ?, title = ?, notes = ?, photo_uri = ?, updated_at = ?, dirty = 1
     WHERE id = ?;`,
    [payload.timestamp, payload.title, payload.notes ?? null, payload.photo_uri ?? null, now, existing.id],
  );

  return getMilestoneById(existing.id);
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
