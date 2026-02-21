import { MedicationDoseUnit, MedicationLog } from '../types/models';
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
  normalizeRequiredText,
} from './repoValidation';

export type MedicationInput = {
  timestamp: string;
  medication_name: string;
  dose_value: number;
  dose_unit: MedicationDoseUnit;
  min_interval_hours?: number | null;
  notes?: string | null;
};

const DOSE_UNITS: MedicationDoseUnit[] = ['ml', 'mg', 'drops', 'tablet'];

const normalizeMedicationInput = (input: MedicationInput): MedicationInput => {
  if (!DOSE_UNITS.includes(input.dose_unit)) {
    throw new Error('Dose unit is invalid.');
  }

  return {
    timestamp: normalizeIsoTimestamp(input.timestamp),
    medication_name: normalizeRequiredText(input.medication_name, 'Medication name', 120),
    dose_value: normalizeNumberInRange(input.dose_value, 'Dose value', 0.01, 10000),
    dose_unit: input.dose_unit,
    min_interval_hours: normalizeNullableNumberInRange(input.min_interval_hours, 'Minimum interval', 0.1, 168),
    notes: normalizeOptionalText(input.notes, 'Medication notes', 2000),
  };
};

const assertNoDuplicateMedication = async (babyId: string, input: MedicationInput, excludeId?: string) => {
  await assertNoDuplicateRow({
    table: 'medication_logs',
    babyId,
    timestamp: input.timestamp,
    columns: [
      { column: 'lower(medication_name)', value: input.medication_name.toLowerCase() },
      { column: 'dose_value', value: input.dose_value },
      { column: 'dose_unit', value: input.dose_unit },
    ],
    excludeId,
    message: 'A similar medication entry already exists for this timestamp.',
  });
};

export const addMedicationLog = async (babyId: string, input: MedicationInput) => {
  const normalizedBabyId = await ensureBabyExists(babyId);
  const payload = normalizeMedicationInput(input);
  await assertNoDuplicateMedication(normalizedBabyId, payload);

  const now = nowIso();
  const id = createId('med');

  await runSql(
    `INSERT INTO medication_logs(
      id, baby_id, timestamp, medication_name, dose_value, dose_unit, min_interval_hours, notes,
      created_at, updated_at, deleted_at, dirty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1);`,
    [
      id,
      normalizedBabyId,
      payload.timestamp,
      payload.medication_name,
      payload.dose_value,
      payload.dose_unit,
      payload.min_interval_hours ?? null,
      payload.notes ?? null,
      now,
      now,
    ],
  );

  return getMedicationById(id);
};

export const updateMedicationLog = async (id: string, input: MedicationInput) => {
  const existing = await ensureRecordForUpdate('medication_logs', id, ['id', 'baby_id', 'deleted_at']);
  const payload = normalizeMedicationInput(input);
  await assertNoDuplicateMedication(existing.baby_id, payload, existing.id);

  const now = nowIso();
  await runSql(
    `UPDATE medication_logs
     SET timestamp = ?, medication_name = ?, dose_value = ?, dose_unit = ?, min_interval_hours = ?, notes = ?, updated_at = ?, dirty = 1
     WHERE id = ?;`,
    [
      payload.timestamp,
      payload.medication_name,
      payload.dose_value,
      payload.dose_unit,
      payload.min_interval_hours ?? null,
      payload.notes ?? null,
      now,
      existing.id,
    ],
  );

  return getMedicationById(existing.id);
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
