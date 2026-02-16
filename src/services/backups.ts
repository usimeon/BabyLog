import { Alert } from 'react-native';
import { BackupSettings, DateRange } from '../types/models';
import { exportExcel, exportPdf } from './exports';
import { presetDateRange } from '../utils/dateRange';

const backupRange = (): DateRange => presetDateRange('30d');

const isDue = (lastBackupAt: string | null | undefined, intervalDays: number) => {
  if (!lastBackupAt) return true;
  const nextDueAt = new Date(lastBackupAt).getTime() + intervalDays * 24 * 60 * 60 * 1000;
  return Date.now() >= nextDueAt;
};

export const runBackupNow = async (settings: BackupSettings) => {
  const range = backupRange();
  const exported: string[] = [];

  if (settings.includePdf) {
    await exportPdf(range);
    exported.push('PDF');
  }

  if (settings.includeExcel) {
    await exportExcel(range);
    exported.push('Excel');
  }

  const destinationLabel =
    settings.destination === 'google_drive'
      ? 'Google Drive (via Share Sheet)'
      : settings.destination === 'dropbox'
      ? 'Dropbox (via Share Sheet)'
      : 'Share Sheet';

  Alert.alert('Backup complete', `${exported.join(' + ')} exported for ${destinationLabel}.`);
  return new Date().toISOString();
};

export const runAutoBackupIfDue = async (settings: BackupSettings) => {
  if (!settings.enabled) return null;
  if (!isDue(settings.lastBackupAt, settings.intervalDays)) return null;
  return runBackupNow(settings);
};
