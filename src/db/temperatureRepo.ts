import { TemperatureLog } from '../types/models';
import { createId } from '../utils/id';
import { nowIso } from '../utils/time';
import { getAll, getOne, runSql } from './client';
import {
  assertNoDuplicateRow,
  ensureBabyExists,
  ensureRecordForUpdate,
  normalizeIsoTimestamp,
  normalizeNumberInRange,
  normalizeOptionalText,
} from './repoValidation';

export type TemperatureInput = {
  timestamp: string;
  temperature_c: number;
  notes?: string | null;
};

const normalizeTemperatureInput = (input: TemperatureInput): TemperatureInput => ({
  timestamp: normalizeIsoTimestamp(input.timestamp),
  temperature_c: normalizeNumberInRange(input.temperature_c, 'Temperature', 30, 45, { allowZero: false }),
  notes: normalizeOptionalText(input.notes, 'Temperature notes', 2000),
});

const assertNoDuplicateTemperature = async (babyId: string, input: TemperatureInput, excludeId?: string) => {
  await assertNoDuplicateRow({
    table: 'temperature_logs',
    babyId,
    timestamp: input.timestamp,
    columns: [{ column: 'temperature_c', value: input.temperature_c }],
    excludeId,
    message: 'A similar temperature entry already exists for this timestamp.',
  });
};

export const addTemperatureLog = async (babyId: string, input: TemperatureInput) => {
  const normalizedBabyId = await ensureBabyExists(babyId);
  const payload = normalizeTemperatureInput(input);
  await assertNoDuplicateTemperature(normalizedBabyId, payload);

  const now = nowIso();
  const id = createId('temp');

  await runSql(
    `INSERT INTO temperature_logs(
      id, baby_id, timestamp, temperature_c, notes, created_at, updated_at, deleted_at, dirty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1);`,
    [id, normalizedBabyId, payload.timestamp, payload.temperature_c, payload.notes ?? null, now, now],
  );

  return getTemperatureById(id);
};

export const updateTemperatureLog = async (id: string, input: TemperatureInput) => {
  const existing = await ensureRecordForUpdate('temperature_logs', id, ['id', 'baby_id', 'deleted_at']);
  const payload = normalizeTemperatureInput(input);
  await assertNoDuplicateTemperature(existing.baby_id, payload, existing.id);

  const now = nowIso();
  await runSql(
    `UPDATE temperature_logs
     SET timestamp = ?, temperature_c = ?, notes = ?, updated_at = ?, dirty = 1
     WHERE id = ?;`,
    [payload.timestamp, payload.temperature_c, payload.notes ?? null, now, existing.id],
  );

  return getTemperatureById(existing.id);
};

export const softDeleteTemperatureLog = async (id: string) => {
  const now = nowIso();
  await runSql('UPDATE temperature_logs SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;', [now, now, id]);
};

export const getTemperatureById = async (id: string) => {
  return getOne<TemperatureLog>('SELECT * FROM temperature_logs WHERE id = ? LIMIT 1;', [id]);
};

export const listTemperatureLogs = async (babyId: string) => {
  return getAll<TemperatureLog>(
    'SELECT * FROM temperature_logs WHERE baby_id = ? AND deleted_at IS NULL ORDER BY timestamp DESC;',
    [babyId],
  );
};

export const temperatureRowsForRange = async (babyId: string, from: string, to: string) => {
  return getAll<TemperatureLog>(
    `SELECT * FROM temperature_logs
     WHERE baby_id = ? AND deleted_at IS NULL AND timestamp BETWEEN ? AND ?
     ORDER BY timestamp ASC;`,
    [babyId, from, to],
  );
};
