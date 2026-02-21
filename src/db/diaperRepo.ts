import { DiaperLog, PoopSize } from '../types/models';
import { createId } from '../utils/id';
import { nowIso } from '../utils/time';
import { getAll, getOne, runSql } from './client';
import {
  assertNoDuplicateRow,
  ensureBabyExists,
  ensureRecordForUpdate,
  normalizeBinaryFlag,
  normalizeIsoTimestamp,
  normalizeOptionalText,
} from './repoValidation';

export type DiaperInput = {
  timestamp: string;
  had_pee: number | boolean;
  had_poop: number | boolean;
  poop_size?: PoopSize | null;
  notes?: string | null;
};

const POOP_SIZES: PoopSize[] = ['small', 'medium', 'large'];

const normalizeDiaperInput = (input: DiaperInput): DiaperInput => {
  const hadPee = normalizeBinaryFlag(input.had_pee, 'Pee flag');
  const hadPoop = normalizeBinaryFlag(input.had_poop, 'Poop flag');

  if (!hadPee && !hadPoop) {
    throw new Error('Enable pee and/or poop before saving.');
  }

  const poopSize = hadPoop ? input.poop_size ?? 'small' : null;
  if (poopSize !== null && !POOP_SIZES.includes(poopSize)) {
    throw new Error('Poop size is invalid.');
  }

  return {
    timestamp: normalizeIsoTimestamp(input.timestamp),
    had_pee: hadPee,
    had_poop: hadPoop,
    poop_size: poopSize,
    notes: normalizeOptionalText(input.notes, 'Diaper notes', 2000),
  };
};

const assertNoDuplicateDiaper = async (babyId: string, input: DiaperInput, excludeId?: string) => {
  await assertNoDuplicateRow({
    table: 'diaper_logs',
    babyId,
    timestamp: input.timestamp,
    columns: [
      { column: 'had_pee', value: Number(input.had_pee) },
      { column: 'had_poop', value: Number(input.had_poop) },
      { column: 'poop_size', value: input.poop_size ?? null },
    ],
    excludeId,
    message: 'A similar diaper entry already exists for this timestamp.',
  });
};

export const addDiaperLog = async (babyId: string, input: DiaperInput) => {
  const normalizedBabyId = await ensureBabyExists(babyId);
  const payload = normalizeDiaperInput(input);
  await assertNoDuplicateDiaper(normalizedBabyId, payload);

  const now = nowIso();
  const id = createId('diaper');

  await runSql(
    `INSERT INTO diaper_logs(
      id, baby_id, timestamp, had_pee, had_poop, poop_size, notes, created_at, updated_at, deleted_at, dirty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1);`,
    [
      id,
      normalizedBabyId,
      payload.timestamp,
      Number(payload.had_pee),
      Number(payload.had_poop),
      payload.had_poop ? payload.poop_size ?? 'small' : null,
      payload.notes ?? null,
      now,
      now,
    ],
  );

  return getDiaperById(id);
};

export const updateDiaperLog = async (id: string, input: DiaperInput) => {
  const existing = await ensureRecordForUpdate('diaper_logs', id, ['id', 'baby_id', 'deleted_at']);
  const payload = normalizeDiaperInput(input);
  await assertNoDuplicateDiaper(existing.baby_id, payload, existing.id);

  const now = nowIso();
  await runSql(
    `UPDATE diaper_logs
     SET timestamp = ?, had_pee = ?, had_poop = ?, poop_size = ?, notes = ?, updated_at = ?, dirty = 1
     WHERE id = ?;`,
    [
      payload.timestamp,
      Number(payload.had_pee),
      Number(payload.had_poop),
      payload.had_poop ? payload.poop_size ?? 'small' : null,
      payload.notes ?? null,
      now,
      existing.id,
    ],
  );

  return getDiaperById(existing.id);
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
