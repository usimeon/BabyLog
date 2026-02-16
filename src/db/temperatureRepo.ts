import { TemperatureLog } from '../types/models';
import { createId } from '../utils/id';
import { nowIso } from '../utils/time';
import { getAll, getOne, runSql } from './client';

export type TemperatureInput = {
  timestamp: string;
  temperature_c: number;
  notes?: string | null;
};

export const addTemperatureLog = async (babyId: string, input: TemperatureInput) => {
  const now = nowIso();
  const id = createId('temp');

  await runSql(
    `INSERT INTO temperature_logs(
      id, baby_id, timestamp, temperature_c, notes, created_at, updated_at, deleted_at, dirty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1);`,
    [id, babyId, input.timestamp, input.temperature_c, input.notes ?? null, now, now],
  );

  return getTemperatureById(id);
};

export const updateTemperatureLog = async (id: string, input: TemperatureInput) => {
  const now = nowIso();
  await runSql(
    `UPDATE temperature_logs
     SET timestamp = ?, temperature_c = ?, notes = ?, updated_at = ?, dirty = 1
     WHERE id = ?;`,
    [input.timestamp, input.temperature_c, input.notes ?? null, now, id],
  );

  return getTemperatureById(id);
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
