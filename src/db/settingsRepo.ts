import { getAll, getOne, runSql } from './client';
import { ReminderSettings } from '../types/models';
import { nowIso } from '../utils/time';

const REMINDER_KEY = 'reminder_settings';
const AMOUNT_UNIT_KEY = 'amount_unit';
const WEIGHT_UNIT_KEY = 'weight_unit';
const TEMP_UNIT_KEY = 'temp_unit';
const AUTH_USER_KEY = 'auth_user_id';
const REMINDER_NOTIFICATION_ID = 'reminder_notification_id';
const LAST_SYNC_AT = 'last_sync_at';
const PINNED_LOGS_KEY = 'pinned_logs';
const AI_ENABLED_KEY = 'ai_enabled';
const AI_LAST_SUMMARY_KEY = 'ai_last_summary';

const defaults: ReminderSettings = {
  enabled: false,
  intervalHours: 3,
  quietHoursStart: null,
  quietHoursEnd: null,
  allowDuringQuietHours: false,
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
  if (!raw) return defaults;
  try {
    return { ...defaults, ...JSON.parse(raw) } as ReminderSettings;
  } catch {
    return defaults;
  }
};

export const saveReminderSettings = async (settings: ReminderSettings) => {
  await setSetting(REMINDER_KEY, JSON.stringify(settings));
};

export const getAmountUnit = async () => (await getSetting(AMOUNT_UNIT_KEY)) ?? 'ml';
export const setAmountUnit = async (unit: 'ml' | 'oz') => setSetting(AMOUNT_UNIT_KEY, unit);

export const getWeightUnit = async () => (await getSetting(WEIGHT_UNIT_KEY)) ?? 'lb';
export const setWeightUnit = async (unit: 'kg' | 'lb') => setSetting(WEIGHT_UNIT_KEY, unit);

export const getTempUnit = async () => (await getSetting(TEMP_UNIT_KEY)) ?? 'f';
export const setTempUnit = async (unit: 'c' | 'f') => setSetting(TEMP_UNIT_KEY, unit);

export const setAuthUserId = async (userId: string | null) => setSetting(AUTH_USER_KEY, userId ?? '');
export const getAuthUserId = async () => (await getSetting(AUTH_USER_KEY)) || null;

export const setReminderNotificationId = async (id: string | null) =>
  setSetting(REMINDER_NOTIFICATION_ID, id ?? '');
export const getReminderNotificationId = async () => (await getSetting(REMINDER_NOTIFICATION_ID)) || null;

export const setLastSyncAt = async (iso: string) => setSetting(LAST_SYNC_AT, iso);
export const getLastSyncAt = async () => (await getSetting(LAST_SYNC_AT)) || null;

export const getPinnedLogs = async (): Promise<string[]> => {
  const raw = await getSetting(PINNED_LOGS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === 'string');
  } catch {
    return [];
  }
};

export const setPinnedLogs = async (keys: string[]) => {
  await setSetting(PINNED_LOGS_KEY, JSON.stringify(keys));
};

export const getAiEnabled = async () => (await getSetting(AI_ENABLED_KEY)) !== '0';
export const setAiEnabled = async (enabled: boolean) => setSetting(AI_ENABLED_KEY, enabled ? '1' : '0');

export const getAiLastSummary = async () => {
  return (await getSetting(AI_LAST_SUMMARY_KEY)) || null;
};

export const setAiLastSummary = async (value: string) => {
  await setSetting(AI_LAST_SUMMARY_KEY, value);
};
