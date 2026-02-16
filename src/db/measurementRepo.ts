import { Measurement } from '../types/models';
import { createId } from '../utils/id';
import { nowIso } from '../utils/time';
import { getAll, getOne, runSql } from './client';

export type MeasurementInput = {
  timestamp: string;
  weight_kg: number;
  length_cm?: number | null;
  head_circumference_cm?: number | null;
  notes?: string | null;
};

export const addMeasurement = async (babyId: string, input: MeasurementInput) => {
  const now = nowIso();
  const id = createId('measure');

  await runSql(
    `INSERT INTO measurements(
      id, baby_id, timestamp, weight_kg, length_cm, head_circumference_cm, notes,
      created_at, updated_at, deleted_at, dirty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1);`,
    [
      id,
      babyId,
      input.timestamp,
      input.weight_kg,
      input.length_cm ?? null,
      input.head_circumference_cm ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return getMeasurementById(id);
};

export const updateMeasurement = async (id: string, input: MeasurementInput) => {
  const now = nowIso();
  await runSql(
    `UPDATE measurements
     SET timestamp = ?, weight_kg = ?, length_cm = ?, head_circumference_cm = ?, notes = ?, updated_at = ?, dirty = 1
     WHERE id = ?;`,
    [
      input.timestamp,
      input.weight_kg,
      input.length_cm ?? null,
      input.head_circumference_cm ?? null,
      input.notes ?? null,
      now,
      id,
    ],
  );

  return getMeasurementById(id);
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
