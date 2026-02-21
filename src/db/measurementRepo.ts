import { Measurement } from '../types/models';
import { createId } from '../utils/id';
import { nowIso } from '../utils/time';
import { getAll, getOne, runSql } from './client';
import {
  assertNoDuplicateRow,
  ensureBabyExists,
  ensureRecordForUpdate,
  normalizeIsoTimestamp,
  normalizeNullableNumberInRange,
  normalizeNumberInRange,
  normalizeOptionalText,
} from './repoValidation';

export type MeasurementInput = {
  timestamp: string;
  weight_kg: number;
  length_cm?: number | null;
  head_circumference_cm?: number | null;
  notes?: string | null;
};

const normalizeMeasurementInput = (input: MeasurementInput): MeasurementInput => ({
  timestamp: normalizeIsoTimestamp(input.timestamp),
  weight_kg: normalizeNumberInRange(input.weight_kg, 'Weight', 0.2, 40),
  length_cm: normalizeNullableNumberInRange(input.length_cm, 'Length', 10, 150),
  head_circumference_cm: normalizeNullableNumberInRange(input.head_circumference_cm, 'Head circumference', 10, 80),
  notes: normalizeOptionalText(input.notes, 'Measurement notes', 2000),
});

const assertNoDuplicateMeasurement = async (babyId: string, input: MeasurementInput, excludeId?: string) => {
  await assertNoDuplicateRow({
    table: 'measurements',
    babyId,
    timestamp: input.timestamp,
    columns: [
      { column: 'weight_kg', value: input.weight_kg },
      { column: 'length_cm', value: input.length_cm ?? null },
      { column: 'head_circumference_cm', value: input.head_circumference_cm ?? null },
    ],
    excludeId,
    message: 'A similar growth entry already exists for this timestamp.',
  });
};

export const addMeasurement = async (babyId: string, input: MeasurementInput) => {
  const normalizedBabyId = await ensureBabyExists(babyId);
  const payload = normalizeMeasurementInput(input);
  await assertNoDuplicateMeasurement(normalizedBabyId, payload);

  const now = nowIso();
  const id = createId('measure');

  await runSql(
    `INSERT INTO measurements(
      id, baby_id, timestamp, weight_kg, length_cm, head_circumference_cm, notes,
      created_at, updated_at, deleted_at, dirty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1);`,
    [
      id,
      normalizedBabyId,
      payload.timestamp,
      payload.weight_kg,
      payload.length_cm ?? null,
      payload.head_circumference_cm ?? null,
      payload.notes ?? null,
      now,
      now,
    ],
  );

  return getMeasurementById(id);
};

export const updateMeasurement = async (id: string, input: MeasurementInput) => {
  const existing = await ensureRecordForUpdate('measurements', id, ['id', 'baby_id', 'deleted_at']);
  const payload = normalizeMeasurementInput(input);
  await assertNoDuplicateMeasurement(existing.baby_id, payload, existing.id);

  const now = nowIso();
  await runSql(
    `UPDATE measurements
     SET timestamp = ?, weight_kg = ?, length_cm = ?, head_circumference_cm = ?, notes = ?, updated_at = ?, dirty = 1
     WHERE id = ?;`,
    [
      payload.timestamp,
      payload.weight_kg,
      payload.length_cm ?? null,
      payload.head_circumference_cm ?? null,
      payload.notes ?? null,
      now,
      existing.id,
    ],
  );

  return getMeasurementById(existing.id);
};

export const softDeleteMeasurement = async (id: string) => {
  const now = nowIso();
  await runSql('UPDATE measurements SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;', [now, now, id]);
};

export const getMeasurementById = async (id: string) => {
  return getOne<Measurement>('SELECT * FROM measurements WHERE id = ? LIMIT 1;', [id]);
};

export const listMeasurements = async (babyId: string) => {
  return getAll<Measurement>(
    'SELECT * FROM measurements WHERE baby_id = ? AND deleted_at IS NULL ORDER BY timestamp DESC;',
    [babyId],
  );
};

export const measurementRowsForRange = async (babyId: string, from: string, to: string) => {
  return getAll<Measurement>(
    `SELECT * FROM measurements
     WHERE baby_id = ? AND deleted_at IS NULL AND timestamp BETWEEN ? AND ?
     ORDER BY timestamp ASC;`,
    [babyId, from, to],
  );
};

export const getInitialOnboardingMeasurementByBabyId = async (babyId: string) => {
  return getOne<Measurement>(
    `SELECT * FROM measurements
     WHERE baby_id = ?
       AND deleted_at IS NULL
       AND notes = 'Initial onboarding measurement'
     ORDER BY timestamp ASC
     LIMIT 1;`,
    [babyId],
  );
};
