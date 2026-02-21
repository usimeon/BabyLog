import { Session } from '@supabase/supabase-js';
import { BackupSettings, ReminderSettings, SmartAlertSettings } from '../types/models';
import { postAuthEnsureBabyProfile } from '../services/postAuthEnsureBabyProfile';

export const defaultReminder: ReminderSettings = {
  enabled: false,
  intervalHours: 3,
  quietHoursStart: null,
  quietHoursEnd: null,
  allowDuringQuietHours: false,
};

export const defaultSmartAlerts: SmartAlertSettings = {
  enabled: true,
  feedGapHours: 4.5,
  diaperGapHours: 8,
  feverThresholdC: 38,
  lowFeedsPerDay: 6,
};

export const defaultBackupSettings: BackupSettings = {
  enabled: false,
  destination: 'share',
  intervalDays: 1,
  lastBackupAt: null,
};

export const normalizeName = (name?: string | null) => {
  const trimmed = name?.trim();
  return trimmed && trimmed.length ? trimmed : 'My Baby';
};

export const isPlaceholderBaby = (baby: { name?: string | null; birthdate?: string | null }) => {
  const normalizedName = baby.name?.trim().toLowerCase() ?? '';
  return normalizedName === 'my baby' && !baby.birthdate;
};

export const toBirthdateIso = (birthdate: Date) =>
  new Date(
    Date.UTC(birthdate.getFullYear(), birthdate.getMonth(), birthdate.getDate(), 12, 0, 0, 0),
  ).toISOString();

export const getProfileOwnerKey = (sessionSnapshot: Session | null) => sessionSnapshot?.user?.id ?? '__local__';

export type MinimalBaby = { id: string; name: string; birthdate?: string | null; photo_uri?: string | null };

export const pickPreferredBaby = (babyList: MinimalBaby[], activeBabyId: string | null) => {
  if (!babyList.length) return null;

  const active = activeBabyId ? babyList.find((baby) => baby.id === activeBabyId) : null;
  if (active) return active;

  const complete = babyList.find((baby) => postAuthEnsureBabyProfile(baby));
  if (complete) return complete;

  return babyList[0];
};
