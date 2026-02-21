import { getOne } from './client';

type DuplicateColumn = {
  column: string;
  value: string | number | null;
};

type DuplicateCheckOptions = {
  table: string;
  babyId: string;
  timestamp: string;
  columns: DuplicateColumn[];
  excludeId?: string;
  message: string;
};

const FUTURE_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

const asNumber = (value: number, label: string) => {
  if (!Number.isFinite(value)) throw new Error(`${label} is invalid.`);
  return value;
};

export const normalizeIsoTimestamp = (value: string, label = 'Timestamp') => {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} is invalid.`);
  }
  if (parsed.getTime() > Date.now() + FUTURE_TIMESTAMP_TOLERANCE_MS) {
    throw new Error(`${label} cannot be in the future.`);
  }
  return parsed.toISOString();
};

export const normalizeOptionalText = (value?: string | null, label = 'Text', maxLength = 2000) => {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new Error(`${label} is too long.`);
  }
  return trimmed;
};

export const normalizeRequiredText = (value: string, label: string, maxLength = 120) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${label} is too long.`);
  }
  return trimmed;
};

export const normalizeNumberInRange = (
  value: number,
  label: string,
  min: number,
  max: number,
  options?: { allowZero?: boolean; integer?: boolean },
) => {
  const parsed = asNumber(value, label);
  if (options?.integer && !Number.isInteger(parsed)) {
    throw new Error(`${label} must be a whole number.`);
  }
  if (parsed < min || parsed > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  if (!options?.allowZero && parsed === 0) {
    throw new Error(`${label} must be greater than 0.`);
  }
  return parsed;
};

export const normalizeNullableNumberInRange = (
  value: number | null | undefined,
  label: string,
  min: number,
  max: number,
  options?: { allowZero?: boolean; integer?: boolean },
) => {
  if (value == null) return null;
  return normalizeNumberInRange(value, label, min, max, options);
};

export const normalizeBinaryFlag = (value: number | boolean, label: string): 0 | 1 => {
  if (value === 0 || value === false) return 0;
  if (value === 1 || value === true) return 1;
  throw new Error(`${label} is invalid.`);
};

export const ensureBabyExists = async (babyId: string) => {
  const trimmed = babyId.trim();
  if (!trimmed) {
    throw new Error('Baby profile is required.');
  }
  const row = await getOne<{ id: string }>(
    `SELECT id
     FROM babies
     WHERE id = ?
       AND deleted_at IS NULL
     LIMIT 1;`,
    [trimmed],
  );
  if (!row?.id) {
    throw new Error('Baby profile not found.');
  }
  return trimmed;
};

export const ensureRecordForUpdate = async (
  table: string,
  id: string,
  columns: string[] = ['id', 'baby_id', 'deleted_at'],
) => {
  const trimmed = id.trim();
  if (!trimmed) throw new Error('Entry id is required.');
  const selected = columns.join(', ');
  const row = await getOne<Record<string, any>>(`SELECT ${selected} FROM ${table} WHERE id = ? LIMIT 1;`, [trimmed]);
  if (!row) throw new Error('Entry not found.');
  if (row.deleted_at) throw new Error('Entry has been deleted.');
  return row;
};

export const assertNoDuplicateRow = async (options: DuplicateCheckOptions) => {
  const params: Array<string | number> = [options.babyId, options.timestamp];
  const where: string[] = ['baby_id = ?', 'timestamp = ?', 'deleted_at IS NULL'];

  for (const col of options.columns) {
    if (col.value === null) {
      where.push(`${col.column} IS NULL`);
      continue;
    }
    where.push(`${col.column} = ?`);
    params.push(col.value);
  }

  if (options.excludeId) {
    where.push('id <> ?');
    params.push(options.excludeId);
  }

  const duplicate = await getOne<{ id: string }>(
    `SELECT id
     FROM ${options.table}
     WHERE ${where.join(' AND ')}
     LIMIT 1;`,
    params,
  );

  if (duplicate?.id) {
    throw new Error(options.message);
  }
};
