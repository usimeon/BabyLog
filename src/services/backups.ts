import { Alert } from 'react-native';
import { BackupSettings, DateRange } from '../types/models';
import { exportExcel, exportPdf } from './exports';
import { presetDateRange } from '../utils/dateRange';
import { uploadFileToProvider } from './cloudStorage';

const backupRange = (): DateRange => presetDateRange('30d');

const isDue = (lastBackupAt: string | null | undefined, intervalDays: number) => {
  if (!lastBackupAt) return true;
  const nextDueAt = new Date(lastBackupAt).getTime() + intervalDays * 24 * 60 * 60 * 1000;
  return Date.now() >= nextDueAt;
};

export const runBackupNow = async (settings: BackupSettings, options?: { silent?: boolean }) => {
  const range = backupRange();
  const exported: string[] = [];
  const share = settings.destination === 'share';
  const uploadUris: string[] = [];

  if (settings.includePdf) {
    const uri = await exportPdf(range, { share });
    if (!share) uploadUris.push(uri);
    exported.push('PDF');
  }

  if (settings.includeExcel) {
    const uri = await exportExcel(range, { share });
    if (!share) uploadUris.push(uri);
    exported.push('Excel');
  }

  const destinationLabel =
    settings.destination === 'google_drive'
      ? 'Google Drive'
      : settings.destination === 'dropbox'
      ? 'Dropbox'
      : 'Share Sheet';

  if (settings.destination === 'google_drive' || settings.destination === 'dropbox') {
    for (const uri of uploadUris) {
      await uploadFileToProvider(settings.destination, uri);
    }
  }

  if (!options?.silent) {
    Alert.alert('Backup complete', `${exported.join(' + ')} exported for ${destinationLabel}.`);
  }
  return new Date().toISOString();
};

export const runAutoBackupIfDue = async (settings: BackupSettings) => {
  if (!settings.enabled) return null;
  if (!isDue(settings.lastBackupAt, settings.intervalDays)) return null;
  return runBackupNow(settings, { silent: true });
};
