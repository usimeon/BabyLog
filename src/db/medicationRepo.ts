import { MedicationDoseUnit, MedicationLog } from '../types/models';
import { createId } from '../utils/id';
import { nowIso } from '../utils/time';
import { getAll, getOne, runSql } from './client';

export type MedicationInput = {
  timestamp: string;
  medication_name: string;
  dose_value: number;
  dose_unit: MedicationDoseUnit;
  min_interval_hours?: number | null;
  notes?: string | null;
};

export const addMedicationLog = async (babyId: string, input: MedicationInput) => {
  const now = nowIso();
  const id = createId('med');

  await runSql(
    `INSERT INTO medication_logs(
      id, baby_id, timestamp, medication_name, dose_value, dose_unit, min_interval_hours, notes,
      created_at, updated_at, deleted_at, dirty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1);`,
    [
      id,
      babyId,
      input.timestamp,
      input.medication_name,
      input.dose_value,
      input.dose_unit,
      input.min_interval_hours ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return getMedicationById(id);
};

export const updateMedicationLog = async (id: string, input: MedicationInput) => {
  const now = nowIso();
  await runSql(
    `UPDATE medication_logs
     SET timestamp = ?, medication_name = ?, dose_value = ?, dose_unit = ?, min_interval_hours = ?, notes = ?, updated_at = ?, dirty = 1
     WHERE id = ?;`,
    [
      input.timestamp,
      input.medication_name,
      input.dose_value,
      input.dose_unit,
      input.min_interval_hours ?? null,
      input.notes ?? null,
      now,
      id,
    ],
  );

  return getMedicationById(id);
};

export const softDeleteMedicationLog = async (id: string) => {
  const now = nowIso();
  await runSql('UPDATE medication_logs SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;', [now, now, id]);
};

export const getMedicationById = async (id: string) => {
  return getOne<MedicationLog>('SELECT * FROM medication_logs WHERE id = ? LIMIT 1;', [id]);
};

export const listMedicationLogs = async (babyId: string) => {
  return getAll<MedicationLog>(
    'SELECT * FROM medication_logs WHERE baby_id = ? AND deleted_at IS NULL ORDER BY timestamp DESC;',
    [babyId],
  );
};

export const medicationRowsForRange = async (babyId: string, from: string, to: string) => {
  return getAll<MedicationLog>(
    `SELECT * FROM medication_logs
     WHERE baby_id = ? AND deleted_at IS NULL AND timestamp BETWEEN ? AND ?
     ORDER BY timestamp ASC;`,
    [babyId, from, to],
  );
};

export const getMedicationSpacingAlert = async (babyId: string) => {
  const rows = await getAll<MedicationLog>(
    `SELECT * FROM medication_logs
     WHERE baby_id = ? AND deleted_at IS NULL
     ORDER BY timestamp DESC
     LIMIT 20;`,
    [babyId],
  );

  const sorted = [...rows].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    if (prev.medication_name.toLowerCase() !== current.medication_name.toLowerCase()) continue;
    if (!current.min_interval_hours) continue;
    const hours = (new Date(current.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 36e5;
    if (hours < current.min_interval_hours) {
      return {
        medication: current.medication_name,
        actualHours: hours,
        minHours: current.min_interval_hours,
      };
    }
  }

  return null;
};
