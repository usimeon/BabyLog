import { Alert } from 'react-native';
import { BackupSettings } from '../types/models';

const isDue = (lastBackupAt: string | null | undefined, intervalDays: number) => {
  if (!lastBackupAt) return true;
  const nextDueAt = new Date(lastBackupAt).getTime() + intervalDays * 24 * 60 * 60 * 1000;
  return Date.now() >= nextDueAt;
};

export const runBackupNow = async (settings: BackupSettings, options?: { silent?: boolean }) => {
  if (!options?.silent) {
    Alert.alert('Backup unavailable', 'Backup exports are disabled in this lightweight build.');
  }
  return settings.lastBackupAt ?? null;
};

export const runAutoBackupIfDue = async (settings: BackupSettings) => {
  if (!settings.enabled) return null;
  if (!isDue(settings.lastBackupAt, settings.intervalDays)) return null;
  return runBackupNow(settings, { silent: true });
};
