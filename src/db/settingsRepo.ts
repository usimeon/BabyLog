import { getAll, getOne, runSql } from './client';
import { BackupSettings, ReminderSettings, SmartAlertSettings } from '../types/models';
import { nowIso } from '../utils/time';

const REMINDER_KEY = 'reminder_settings';
const AMOUNT_UNIT_KEY = 'amount_unit';
const WEIGHT_UNIT_KEY = 'weight_unit';
const TEMP_UNIT_KEY = 'temp_unit';
const AUTH_USER_KEY = 'auth_user_id';
const REMINDER_NOTIFICATION_ID = 'reminder_notification_id';
const LAST_SYNC_AT = 'last_sync_at';
const PINNED_LOGS_KEY = 'pinned_logs';
const SMART_ALERTS_KEY = 'smart_alert_settings';
const BACKUP_SETTINGS_KEY = 'backup_settings';
const BABY_SEX_KEY = 'baby_sex';
const ACTIVE_BABY_ID_KEY = 'active_baby_id';
const LOCAL_DATA_OWNER_USER_KEY = 'local_data_owner_user_id';
const REQUIRED_PROFILE_OWNER_USER_KEY = 'required_profile_owner_user_id';

const amountUnits = new Set(['ml', 'oz']);
const weightUnits = new Set(['kg', 'lb']);
const tempUnits = new Set(['c', 'f']);
const backupDestinations = new Set(['share', 'google_drive', 'dropbox']);

const defaults: ReminderSettings = {
  enabled: false,
  intervalHours: 3,
  quietHoursStart: null,
  quietHoursEnd: null,
  allowDuringQuietHours: false,
};

const smartAlertDefaults: SmartAlertSettings = {
  enabled: true,
  feedGapHours: 4.5,
  diaperGapHours: 8,
  feverThresholdC: 38,
  lowFeedsPerDay: 6,
};

const backupDefaults: BackupSettings = {
  enabled: false,
  destination: 'share',
  intervalDays: 1,
  lastBackupAt: null,
};

const parseNumber = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  options?: { integer?: boolean },
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (options?.integer && !Number.isInteger(parsed)) return fallback;
  if (parsed < min || parsed > max) return fallback;
  return parsed;
};

const normalizeHhMm = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) return null;
  return trimmed;
};

const normalizeReminderSettings = (input: Partial<ReminderSettings> | null | undefined): ReminderSettings => {
  const merged = { ...defaults, ...(input ?? {}) };
  return {
    enabled: Boolean(merged.enabled),
    intervalHours: parseNumber(merged.intervalHours, defaults.intervalHours, 1, 24, { integer: false }),
    quietHoursStart: normalizeHhMm(merged.quietHoursStart),
    quietHoursEnd: normalizeHhMm(merged.quietHoursEnd),
    allowDuringQuietHours: Boolean(merged.allowDuringQuietHours),
  };
};

const normalizeSmartAlertSettings = (
  input: Partial<SmartAlertSettings> | null | undefined,
): SmartAlertSettings => {
  const merged = { ...smartAlertDefaults, ...(input ?? {}) };
  return {
    enabled: Boolean(merged.enabled),
    feedGapHours: parseNumber(merged.feedGapHours, smartAlertDefaults.feedGapHours, 0.5, 24),
    diaperGapHours: parseNumber(merged.diaperGapHours, smartAlertDefaults.diaperGapHours, 1, 48),
    feverThresholdC: parseNumber(merged.feverThresholdC, smartAlertDefaults.feverThresholdC, 35, 43),
    lowFeedsPerDay: parseNumber(merged.lowFeedsPerDay, smartAlertDefaults.lowFeedsPerDay, 1, 30, { integer: true }),
  };
};

const normalizeBackupSettings = (input: Partial<BackupSettings> | null | undefined): BackupSettings => {
  const merged = { ...backupDefaults, ...(input ?? {}) };
  const destination = backupDestinations.has(String(merged.destination))
    ? (merged.destination as BackupSettings['destination'])
    : backupDefaults.destination;

  let lastBackupAt: string | null = null;
  if (merged.lastBackupAt) {
    const parsed = new Date(merged.lastBackupAt);
    if (!Number.isNaN(parsed.getTime())) {
      lastBackupAt = parsed.toISOString();
    }
  }

  return {
    enabled: Boolean(merged.enabled),
    destination,
    intervalDays: parseNumber(merged.intervalDays, backupDefaults.intervalDays, 1, 30, { integer: true }),
    lastBackupAt,
  };
};

const parseJson = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const setSetting = async (key: string, value: string) => {
  await runSql(
    `INSERT INTO settings(key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
    [key, value, nowIso()],
  );
};

export const getSetting = async (key: string) => {
  const row = await getOne<{ value: string }>('SELECT value FROM settings WHERE key = ? LIMIT 1;', [key]);
  return row?.value ?? null;
};

export const getAllSettings = async () => {
  return getAll<{ key: string; value: string }>('SELECT key, value FROM settings;');
};

export const getReminderSettings = async (): Promise<ReminderSettings> => {
  const raw = await getSetting(REMINDER_KEY);
  return normalizeReminderSettings(parseJson<Partial<ReminderSettings>>(raw, defaults));
};

export const saveReminderSettings = async (settings: ReminderSettings) => {
  await setSetting(REMINDER_KEY, JSON.stringify(normalizeReminderSettings(settings)));
};

export const getAmountUnit = async () => {
  const unit = (await getSetting(AMOUNT_UNIT_KEY)) ?? 'ml';
  return amountUnits.has(unit) ? unit : 'ml';
};

export const setAmountUnit = async (unit: 'ml' | 'oz') => setSetting(AMOUNT_UNIT_KEY, unit);

export const getWeightUnit = async () => {
  const unit = (await getSetting(WEIGHT_UNIT_KEY)) ?? 'lb';
  return weightUnits.has(unit) ? unit : 'lb';
};

export const setWeightUnit = async (unit: 'kg' | 'lb') => setSetting(WEIGHT_UNIT_KEY, unit);

export const getTempUnit = async () => {
  const unit = (await getSetting(TEMP_UNIT_KEY)) ?? 'f';
  return tempUnits.has(unit) ? unit : 'f';
};

export const setTempUnit = async (unit: 'c' | 'f') => setSetting(TEMP_UNIT_KEY, unit);

export const setAuthUserId = async (userId: string | null) => setSetting(AUTH_USER_KEY, userId ?? '');
export const getAuthUserId = async () => (await getSetting(AUTH_USER_KEY)) || null;

export const setLocalDataOwnerUserId = async (userId: string | null) =>
  setSetting(LOCAL_DATA_OWNER_USER_KEY, userId ?? '');

export const getLocalDataOwnerUserId = async () => {
  const value = await getSetting(LOCAL_DATA_OWNER_USER_KEY);
  return value?.trim() || null;
};

export const setReminderNotificationId = async (id: string | null) =>
  setSetting(REMINDER_NOTIFICATION_ID, id ?? '');

export const getReminderNotificationId = async () => (await getSetting(REMINDER_NOTIFICATION_ID)) || null;

export const setLastSyncAt = async (iso: string | null) => setSetting(LAST_SYNC_AT, iso ?? '');

export const getLastSyncAt = async () => {
  const raw = await getSetting(LAST_SYNC_AT);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

export const getPinnedLogs = async (): Promise<string[]> => {
  const raw = await getSetting(PINNED_LOGS_KEY);
  if (!raw) return [];
  const parsed = parseJson<unknown[]>(raw, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((x): x is string => typeof x === 'string');
};

export const setPinnedLogs = async (keys: string[]) => {
  const deduped = Array.from(new Set(keys.filter((x) => typeof x === 'string' && x.trim().length > 0)));
  await setSetting(PINNED_LOGS_KEY, JSON.stringify(deduped));
};

export const getSmartAlertSettings = async (): Promise<SmartAlertSettings> => {
  const raw = await getSetting(SMART_ALERTS_KEY);
  return normalizeSmartAlertSettings(parseJson<Partial<SmartAlertSettings>>(raw, smartAlertDefaults));
};

export const saveSmartAlertSettings = async (settings: SmartAlertSettings) => {
  await setSetting(SMART_ALERTS_KEY, JSON.stringify(normalizeSmartAlertSettings(settings)));
};

export const getBackupSettings = async (): Promise<BackupSettings> => {
  const raw = await getSetting(BACKUP_SETTINGS_KEY);
  return normalizeBackupSettings(parseJson<Partial<BackupSettings>>(raw, backupDefaults));
};

export const saveBackupSettings = async (settings: BackupSettings) => {
  await setSetting(BACKUP_SETTINGS_KEY, JSON.stringify(normalizeBackupSettings(settings)));
};

export const getBabySex = async (): Promise<'boy' | 'girl' | 'other' | null> => {
  const value = await getSetting(BABY_SEX_KEY);
  if (value === 'boy' || value === 'girl' || value === 'other') return value;
  return null;
};

export const setBabySex = async (value: 'boy' | 'girl' | 'other') => {
  await setSetting(BABY_SEX_KEY, value);
};

export const getActiveBabyId = async () => {
  const value = await getSetting(ACTIVE_BABY_ID_KEY);
  return value?.trim() || null;
};

export const setActiveBabyId = async (babyId: string) => {
  await setSetting(ACTIVE_BABY_ID_KEY, babyId);
};

export const clearActiveBabyId = async () => {
  await setSetting(ACTIVE_BABY_ID_KEY, '');
};

export const setRequiredProfileOwnerUserId = async (userId: string | null) =>
  setSetting(REQUIRED_PROFILE_OWNER_USER_KEY, userId ?? '');

export const getRequiredProfileOwnerUserId = async () => {
  const value = await getSetting(REQUIRED_PROFILE_OWNER_USER_KEY);
  return value?.trim() || null;
};
