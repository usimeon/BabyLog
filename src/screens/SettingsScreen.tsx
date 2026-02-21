import React, { useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../app/navigation';
import { Button, Card, InlineMessage, Input, Label, Row, SelectPill } from '../components/ui';
import { useAppContext } from '../context/AppContext';
import { clearLocalAccountData } from '../db/accountRepo';
import { getBabyById, isBabyNameTaken, softDeleteBaby, upsertBaby } from '../db/babyRepo';
import { addMeasurement, getInitialOnboardingMeasurementByBabyId, updateMeasurement } from '../db/measurementRepo';
import { connectCloudProvider, getCloudProviderConnected } from '../services/cloudStorage';
import { cancelReminder, requestNotificationPermission } from '../services/notifications';
import { recalculateReminder } from '../services/reminderCoordinator';
import { validateBabyProfile } from '../services/babyProfileValidation';
import { runBackupNow } from '../services/backups';
import { deleteMyAccount, signOut } from '../supabase/auth';
import { BackupDestination } from '../types/models';
import { getTheme } from '../theme/designSystem';
import { useAppTheme } from '../theme/useAppTheme';
import { formatDateTime, nowIso } from '../utils/time';
import { displayToKg, kgToDisplay } from '../utils/units';
import { SyncBanner } from '../components/SyncBanner';

type ToastState = { kind: 'success' | 'error' | 'info'; message: string } | null;
type SectionKey = 'babies' | 'units' | 'reminders' | 'backup' | 'account';
type SettingsField =
  | 'intervalHours'
  | 'feedGapHours'
  | 'backupIntervalDays'
  | 'editBabyName'
  | 'editBirthWeight'
  | 'editBirthLengthCm'
  | 'editBirthHeadCm';

const MAX_BABY_NAME_LENGTH = 120;

const toUtcNoonIso = (value: Date) => {
  const utc = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0));
  return utc.toISOString();
};

const parseRequiredNumber = (
  raw: string,
  label: string,
  options: { min: number; max: number; integer?: boolean },
) => {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null as number | null, error: `${label} is required.` };

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return { value: null as number | null, error: `${label} must be a valid number.` };
  }

  if (options.integer && !Number.isInteger(parsed)) {
    return { value: null as number | null, error: `${label} must be a whole number.` };
  }

  if (parsed < options.min || parsed > options.max) {
    return { value: null as number | null, error: `${label} must be between ${options.min} and ${options.max}.` };
  }

  return { value: parsed, error: null as string | null };
};

const InlineSettingRow = ({
  label,
  children,
  styles,
}: React.PropsWithChildren<{ label: string; styles: ReturnType<typeof createStyles> }>) => (
  <View style={styles.inlineSettingRow}>
    <Label style={styles.inlineSettingLabel}>{label}</Label>
    <View style={styles.inlineControlWrap}>{children}</View>
  </View>
);

const CollapsibleCard = ({
  title,
  expanded,
  onToggle,
  children,
  styles,
}: React.PropsWithChildren<{
  title: string;
  expanded: boolean;
  onToggle: () => void;
  styles: ReturnType<typeof createStyles>;
}>) => {
  const theme = useAppTheme();
  return (
    <Card style={styles.compactCard}>
      <Pressable
        style={styles.sectionHeaderRow}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
      >
        <Text style={[styles.sectionHeaderTitle, { color: theme.colors.textPrimary }]}>{title}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.textSecondary} />
      </Pressable>
      {expanded ? <View style={[styles.sectionBody, { borderTopColor: theme.colors.border }]}>{children}</View> : null}
    </Card>
  );
};

export const SettingsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {
    babyId,
    babies,
    amountUnit,
    weightUnit,
    tempUnit,
    reminderSettings,
    smartAlertSettings,
    backupSettings,
    updateAmountUnit,
    updateWeightUnit,
    updateTempUnit,
    updateReminderSettings,
    updateSmartAlertSettings,
    updateBackupSettings,
    refreshAppState,
    switchActiveBaby,
    session,
    supabaseEnabled,
    syncNow,
    syncState,
    syncError,
    lastSyncAt,
  } = useAppContext();

  const [intervalHours, setIntervalHours] = useState(String(reminderSettings.intervalHours));
  const [feedGapHours, setFeedGapHours] = useState(String(smartAlertSettings.feedGapHours));
  const [backupIntervalDays, setBackupIntervalDays] = useState(String(backupSettings.intervalDays));
  const [editingBabyId, setEditingBabyId] = useState<string | null>(null);
  const [editBabyName, setEditBabyName] = useState('');
  const [editBirthdate, setEditBirthdate] = useState<Date>(new Date());
  const [editHasBirthdate, setEditHasBirthdate] = useState(false);
  const [editBirthMeasurementId, setEditBirthMeasurementId] = useState<string | null>(null);
  const [editBirthMeasurementTimestamp, setEditBirthMeasurementTimestamp] = useState<string | null>(null);
  const [editBirthWeight, setEditBirthWeight] = useState('');
  const [editBirthLengthCm, setEditBirthLengthCm] = useState('');
  const [editBirthHeadCm, setEditBirthHeadCm] = useState('');
  const [editPhotoUri, setEditPhotoUri] = useState<string | null>(null);
  const [pendingDeleteBabyId, setPendingDeleteBabyId] = useState<string | null>(null);
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [dropboxConnected, setDropboxConnected] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    babies: true,
    units: false,
    reminders: false,
    backup: false,
    account: false,
  });
  const [toast, setToast] = useState<ToastState>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SettingsField, string>>>({});
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reminderIntervalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const smartAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupIntervalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bothBackupProvidersConnected = driveConnected && dropboxConnected;

  React.useEffect(() => {
    const loadConnections = async () => {
      const [drive, dropbox] = await Promise.all([
        getCloudProviderConnected('google_drive'),
        getCloudProviderConnected('dropbox'),
      ]);
      setDriveConnected(drive);
      setDropboxConnected(dropbox);
    };
    loadConnections();
  }, []);

  const toggleSection = (key: SectionKey) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const showToast = (message: string, kind: NonNullable<ToastState>['kind'] = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ kind, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  };

  const clearFieldError = (field: SettingsField) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const setFieldError = (field: SettingsField, message: string) => {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  };

  const applyReminderSettings = async (enabled: boolean, options?: { notify?: boolean; silent?: boolean }) => {
    try {
      const parsedInterval = parseRequiredNumber(intervalHours, 'Reminder interval', { min: 1, max: 24 });
      if (parsedInterval.error || parsedInterval.value === null) {
        setFieldError('intervalHours', parsedInterval.error ?? 'Reminder interval is invalid.');
        if (!options?.silent) {
          showToast(parsedInterval.error ?? 'Reminder interval is invalid.', 'error');
        }
        return;
      }
      clearFieldError('intervalHours');

      const nextSettings = {
        enabled,
        intervalHours: parsedInterval.value,
        quietHoursStart: null,
        quietHoursEnd: null,
        allowDuringQuietHours: false,
      };
      setIntervalHours(String(parsedInterval.value));

      const isUnchanged = enabled === reminderSettings.enabled && parsedInterval.value === reminderSettings.intervalHours;
      if (isUnchanged) return;

      if (enabled && !reminderSettings.enabled) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          if (!options?.silent) {
            showToast('Notification permission is required for reminders.', 'error');
          }
          return;
        }
      }

      if (enabled) {
        await updateReminderSettings(nextSettings);
        await recalculateReminder(babyId, nextSettings);
        if (options?.notify && !options?.silent) {
          showToast(`Reminders are enabled every ${nextSettings.intervalHours} hour(s).`, 'success');
        }
        return;
      }

      await cancelReminder();
      await updateReminderSettings(nextSettings);
      if (options?.notify && !options?.silent) {
        showToast('Reminders disabled and pending notifications cancelled.', 'success');
      }
    } catch (error: any) {
      if (!options?.silent) {
        showToast(`Reminder update failed: ${error?.message ?? 'Unknown error'}`, 'error');
      }
    }
  };

  React.useEffect(() => {
    if (intervalHours.trim() === String(reminderSettings.intervalHours)) {
      clearFieldError('intervalHours');
      return;
    }

    if (reminderIntervalTimerRef.current) {
      clearTimeout(reminderIntervalTimerRef.current);
    }

    reminderIntervalTimerRef.current = setTimeout(() => {
      void applyReminderSettings(reminderSettings.enabled, { silent: true });
    }, 450);

    return () => {
      if (reminderIntervalTimerRef.current) {
        clearTimeout(reminderIntervalTimerRef.current);
      }
    };
  }, [intervalHours, reminderSettings.enabled, reminderSettings.intervalHours]);

  const applySmartAlerts = async (enabled: boolean, options?: { notify?: boolean; silent?: boolean }) => {
    try {
      const parsedFeedGap = parseRequiredNumber(feedGapHours, 'Feed gap warning', { min: 0.5, max: 24 });
      if (parsedFeedGap.error || parsedFeedGap.value === null) {
        setFieldError('feedGapHours', parsedFeedGap.error ?? 'Feed gap warning is invalid.');
        if (!options?.silent) {
          showToast(parsedFeedGap.error ?? 'Feed gap warning is invalid.', 'error');
        }
        return;
      }

      clearFieldError('feedGapHours');

      const next = {
        ...smartAlertSettings,
        enabled,
        feedGapHours: parsedFeedGap.value as number,
      };
      const isUnchanged = next.enabled === smartAlertSettings.enabled && next.feedGapHours === smartAlertSettings.feedGapHours;
      if (isUnchanged) return;

      await updateSmartAlertSettings(next);
      setFeedGapHours(String(next.feedGapHours));
      if (options?.notify && !options?.silent) {
        showToast(`Smart alerts ${enabled ? 'enabled' : 'disabled'}.`, 'success');
      }
    } catch (error: any) {
      if (!options?.silent) {
        showToast(`Smart alerts update failed: ${error?.message ?? 'Unknown error'}`, 'error');
      }
    }
  };

  React.useEffect(() => {
    if (feedGapHours.trim() === String(smartAlertSettings.feedGapHours)) {
      clearFieldError('feedGapHours');
      return;
    }

    if (smartAlertTimerRef.current) {
      clearTimeout(smartAlertTimerRef.current);
    }

    smartAlertTimerRef.current = setTimeout(() => {
      void applySmartAlerts(smartAlertSettings.enabled, { silent: true });
    }, 450);

    return () => {
      if (smartAlertTimerRef.current) {
        clearTimeout(smartAlertTimerRef.current);
      }
    };
  }, [feedGapHours, smartAlertSettings.enabled, smartAlertSettings.feedGapHours]);

  const toggleSmartAlerts = async (enabled: boolean) => {
    await applySmartAlerts(enabled, { notify: true });
  };

  const setBackupDestination = async (destination: BackupDestination) => {
    try {
      if (destination === 'google_drive' || destination === 'dropbox') {
        const connected = destination === 'google_drive' ? driveConnected : dropboxConnected;
        if (!connected) {
          await connectCloudProvider(destination);
          if (destination === 'google_drive') setDriveConnected(true);
          if (destination === 'dropbox') setDropboxConnected(true);
          showToast(`${destination === 'google_drive' ? 'Google Drive' : 'Dropbox'} connected.`, 'success');
        }
      }

      await updateBackupSettings({ ...backupSettings, destination });
      if (backupSettings.destination !== destination) {
        showToast('Backup destination updated.', 'success');
      }
    } catch (error: any) {
      showToast(`Backup destination failed: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  const getValidatedBackupIntervalDays = () => {
    const parsed = parseRequiredNumber(backupIntervalDays, 'Backup interval', { min: 1, max: 30, integer: true });
    if (parsed.error || parsed.value === null) {
      setFieldError('backupIntervalDays', parsed.error ?? 'Backup interval is invalid.');
      return null;
    }
    clearFieldError('backupIntervalDays');
    setBackupIntervalDays(String(parsed.value));
    return parsed.value;
  };

  const toggleAutoBackup = async (enabled: boolean) => {
    try {
      const intervalDays = getValidatedBackupIntervalDays();
      if (intervalDays === null) {
        showToast('Backup interval must be between 1 and 30 days.', 'error');
        return;
      }
      const next = {
        ...backupSettings,
        enabled,
        intervalDays,
      };
      await updateBackupSettings(next);
      showToast(`Auto backup ${enabled ? 'enabled' : 'disabled'}.`, 'success');
    } catch (error: any) {
      showToast(`Auto backup failed: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  const applyBackupSettings = async (options?: { notify?: boolean; silent?: boolean }) => {
    try {
      const intervalDays = getValidatedBackupIntervalDays();
      if (intervalDays === null) {
        if (!options?.silent) {
          showToast('Backup interval must be between 1 and 30 days.', 'error');
        }
        return;
      }
      if (intervalDays === backupSettings.intervalDays) {
        return;
      }
      await updateBackupSettings({
        ...backupSettings,
        intervalDays,
      });
      if (options?.notify && !options?.silent) {
        showToast('Backup interval updated.', 'success');
      }
    } catch (error: any) {
      if (!options?.silent) {
        showToast(`Backup settings failed: ${error?.message ?? 'Unknown error'}`, 'error');
      }
    }
  };

  React.useEffect(() => {
    if (backupIntervalDays.trim() === String(backupSettings.intervalDays)) {
      clearFieldError('backupIntervalDays');
      return;
    }

    if (backupIntervalTimerRef.current) {
      clearTimeout(backupIntervalTimerRef.current);
    }

    backupIntervalTimerRef.current = setTimeout(() => {
      void applyBackupSettings({ silent: true });
    }, 450);

    return () => {
      if (backupIntervalTimerRef.current) {
        clearTimeout(backupIntervalTimerRef.current);
      }
    };
  }, [backupIntervalDays, backupSettings.intervalDays]);

  const onRunBackupNow = async () => {
    try {
      const intervalDays = getValidatedBackupIntervalDays();
      if (intervalDays === null) {
        showToast('Backup interval must be between 1 and 30 days.', 'error');
        return;
      }
      const lastBackupAt = await runBackupNow({ ...backupSettings, intervalDays });
      await updateBackupSettings({ ...backupSettings, intervalDays, lastBackupAt });
      showToast('Backup created and uploaded successfully.', 'success');
    } catch (error: any) {
      showToast(`Backup failed: ${error?.message ?? 'Unknown backup error'}`, 'error');
    }
  };

  const startEditBaby = async (targetBabyId: string) => {
    const baby = await getBabyById(targetBabyId);
    if (!baby) {
      showToast('Baby profile not found.', 'error');
      return;
    }
    setEditingBabyId(targetBabyId);
    setPendingDeleteBabyId(null);
    setFieldErrors({});
    setEditBabyName(baby.name ?? '');
    setEditPhotoUri(baby.photo_uri ?? null);
    if (!baby.birthdate) {
      setEditHasBirthdate(false);
      setEditBirthdate(new Date());
    } else {
      const parsed = new Date(baby.birthdate);
      if (Number.isNaN(parsed.getTime())) {
        setEditHasBirthdate(false);
        setEditBirthdate(new Date());
      } else {
        setEditHasBirthdate(true);
        setEditBirthdate(parsed);
      }
    }

    const initialMeasurement = await getInitialOnboardingMeasurementByBabyId(targetBabyId);
    if (!initialMeasurement) {
      setEditBirthMeasurementId(null);
      setEditBirthMeasurementTimestamp(null);
      setEditBirthWeight('');
      setEditBirthLengthCm('');
      setEditBirthHeadCm('');
      return;
    }

    setEditBirthMeasurementId(initialMeasurement.id);
    setEditBirthMeasurementTimestamp(initialMeasurement.timestamp);
    setEditBirthWeight(kgToDisplay(initialMeasurement.weight_kg, weightUnit).toFixed(2));
    setEditBirthLengthCm(initialMeasurement.length_cm ? String(initialMeasurement.length_cm) : '');
    setEditBirthHeadCm(
      initialMeasurement.head_circumference_cm ? String(initialMeasurement.head_circumference_cm) : '',
    );
  };

  const pickBabyPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Photo library permission is needed to attach a baby photo.', 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets.length > 0) {
      setEditPhotoUri(result.assets[0].uri);
    }
  };

  const applyBabyProfile = async () => {
    try {
      if (!editingBabyId) return;
      const nextErrors: Partial<Record<SettingsField, string>> = {};
      const trimmedName = editBabyName.trim();
      if (!trimmedName) {
        nextErrors.editBabyName = 'Baby name is required.';
      } else if (trimmedName.length > MAX_BABY_NAME_LENGTH) {
        nextErrors.editBabyName = `Baby name must be ${MAX_BABY_NAME_LENGTH} characters or fewer.`;
      }

      if (editHasBirthdate) {
        const birthValidation = validateBabyProfile(trimmedName || 'Baby', editBirthdate);
        if (birthValidation) {
          nextErrors.editBabyName = birthValidation;
        }
      }

      const trimmedWeight = editBirthWeight.trim();
      const trimmedLength = editBirthLengthCm.trim();
      const trimmedHead = editBirthHeadCm.trim();
      let parsedWeightKg: number | null = null;
      let parsedLengthCm: number | null = null;
      let parsedHeadCm: number | null = null;

      if (!trimmedWeight && (trimmedLength || trimmedHead)) {
        nextErrors.editBirthWeight = `Enter weight in ${weightUnit}, or clear length and head circumference.`;
      }

      if (trimmedWeight) {
        const parsedWeightDisplay = Number(trimmedWeight);
        if (!Number.isFinite(parsedWeightDisplay) || parsedWeightDisplay <= 0) {
          nextErrors.editBirthWeight = `Enter a valid weight in ${weightUnit}.`;
        } else {
          parsedWeightKg = displayToKg(parsedWeightDisplay, weightUnit);
          if (!Number.isFinite(parsedWeightKg) || parsedWeightKg < 0.2 || parsedWeightKg > 40) {
            nextErrors.editBirthWeight = 'Birth weight must be between 0.2 and 40 kg.';
          }
        }
      }

      if (trimmedLength) {
        const parsedLength = Number(trimmedLength);
        if (!Number.isFinite(parsedLength) || parsedLength < 10 || parsedLength > 150) {
          nextErrors.editBirthLengthCm = 'Birth length must be between 10 and 150 cm.';
        } else {
          parsedLengthCm = parsedLength;
        }
      }

      if (trimmedHead) {
        const parsedHead = Number(trimmedHead);
        if (!Number.isFinite(parsedHead) || parsedHead < 10 || parsedHead > 80) {
          nextErrors.editBirthHeadCm = 'Head circumference must be between 10 and 80 cm.';
        } else {
          parsedHeadCm = parsedHead;
        }
      }

      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
        const firstError = Object.values(nextErrors)[0];
        if (firstError) showToast(firstError, 'error');
        return;
      }

      clearFieldError('editBabyName');
      clearFieldError('editBirthWeight');
      clearFieldError('editBirthLengthCm');
      clearFieldError('editBirthHeadCm');

      const nameTaken = await isBabyNameTaken(trimmedName, { excludeBabyId: editingBabyId });
      if (nameTaken) throw new Error('Baby name already exists. Use a different name.');

      const existing = await getBabyById(editingBabyId);
      if (!existing) throw new Error('Baby profile not found.');

      const nextBirthdate = editHasBirthdate ? toUtcNoonIso(editBirthdate) : null;
      await upsertBaby(
        {
          ...existing,
          name: trimmedName,
          birthdate: nextBirthdate,
          photo_uri: editPhotoUri,
          updated_at: nowIso(),
        },
        true,
      );

      if (trimmedWeight || trimmedLength || trimmedHead) {
        const measurementTimestamp =
          editBirthMeasurementTimestamp ??
          nextBirthdate ??
          new Date(
            Date.UTC(
              editBirthdate.getFullYear(),
              editBirthdate.getMonth(),
              editBirthdate.getDate(),
              12,
              0,
              0,
              0,
            ),
          ).toISOString();

        const payload = {
          timestamp: measurementTimestamp,
          weight_kg: parsedWeightKg as number,
          length_cm: parsedLengthCm,
          head_circumference_cm: parsedHeadCm,
          notes: 'Initial onboarding measurement',
        };

        if (editBirthMeasurementId) {
          await updateMeasurement(editBirthMeasurementId, payload);
        } else {
          const inserted = await addMeasurement(editingBabyId, payload);
          setEditBirthMeasurementId(inserted?.id ?? null);
          setEditBirthMeasurementTimestamp(inserted?.timestamp ?? measurementTimestamp);
        }
      }

      await refreshAppState();
      await syncNow();
      setEditingBabyId(null);
      setPendingDeleteBabyId(null);
      showToast('Baby profile updated.', 'success');
    } catch (error: any) {
      showToast(`Baby profile update failed: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  const onSwitchBaby = async (nextBabyId: string, nextBabyName: string) => {
    try {
      await switchActiveBaby(nextBabyId);
      setPendingDeleteBabyId(null);
      showToast(`Switched to ${nextBabyName}.`, 'success');
    } catch (error: any) {
      showToast(`Could not switch baby: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  const deleteBabyProfile = async (targetBabyId: string, targetBabyName: string) => {
    if (babies.length <= 1) {
      showToast('At least one baby profile is required.', 'error');
      return;
    }

    if (pendingDeleteBabyId !== targetBabyId) {
      setPendingDeleteBabyId(targetBabyId);
      showToast(`Tap delete again to remove ${targetBabyName}.`, 'info');
      return;
    }

    setPendingDeleteBabyId(null);
    try {
      await softDeleteBaby(targetBabyId);
      if (editingBabyId === targetBabyId) setEditingBabyId(null);

      if (targetBabyId === babyId) {
        const fallback = babies.find((baby) => baby.id !== targetBabyId);
        if (fallback) await switchActiveBaby(fallback.id);
      } else {
        await refreshAppState();
      }

      await syncNow();
      showToast(`${targetBabyName} deleted.`, 'success');
    } catch (error: any) {
      showToast(`Delete failed: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  const onSignOut = async () => {
    try {
      setPendingDeleteAccount(false);
      await signOut();
      showToast('Signed out successfully.', 'success');
    } catch (error: any) {
      showToast(`Sign out failed: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  const onDeleteAccount = async () => {
    if (!session) {
      showToast('You must be signed in to delete account.', 'error');
      return;
    }

    if (deletingAccount) return;

    if (!pendingDeleteAccount) {
      setPendingDeleteAccount(true);
      showToast('Tap Delete My Account again to permanently delete your account and all data.', 'info');
      return;
    }

    setPendingDeleteAccount(false);
    setDeletingAccount(true);
    try {
      await deleteMyAccount();
      await clearLocalAccountData();
      try {
        await signOut();
      } catch {
        // Session may already be invalid after account deletion.
      }
      await refreshAppState();
      showToast('Account deleted permanently.', 'success');
    } catch (error: any) {
      showToast(`Delete account failed: ${error?.message ?? 'Unknown error'}`, 'error');
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <SyncBanner syncState={syncState} syncError={syncError} lastSyncAt={lastSyncAt} enabled={supabaseEnabled} />

        <CollapsibleCard title="Babies" expanded={expandedSections.babies} onToggle={() => toggleSection('babies')} styles={styles}>
          <Row>
            <Ionicons name="people-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>Manage baby profiles</Text>
          </Row>
          <View style={styles.accountList}>
            {babies.map((baby, index) => {
              const isActive = baby.id === babyId;
              const initial = (baby.name.trim().charAt(0) || 'B').toUpperCase();

              return (
                <View key={baby.id} style={[styles.accountItemWrap, index < babies.length - 1 ? styles.accountItemSeparator : null]}>
                  <View style={styles.accountItem}>
                    <Pressable
                      style={styles.accountLeft}
                      onPress={() => onSwitchBaby(baby.id, baby.name)}
                      accessibilityRole="button"
                      accessibilityLabel={`Switch to ${baby.name}`}
                    >
                      <View
                        style={[
                          styles.accountAvatar,
                          { backgroundColor: isActive ? '#FFE194' : theme.colors.surfaceAlt, borderColor: theme.colors.border },
                        ]}
                      >
                        {baby.photoUri ? (
                          <Image source={{ uri: baby.photoUri }} style={styles.accountAvatarImage} />
                        ) : (
                          <Text style={[styles.accountAvatarText, { color: isActive ? '#7A5A00' : theme.colors.textSecondary }]}>
                            {initial}
                          </Text>
                        )}
                      </View>
                      <View style={styles.accountInfoWrap}>
                        <View style={styles.accountNameRow}>
                          <Text style={[styles.accountName, { color: theme.colors.textPrimary }]}>{baby.name}</Text>
                          <View style={styles.inlineBabyActions}>
                            <Pressable
                              style={[styles.inlineEditBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }]}
                              onPress={() => startEditBaby(baby.id)}
                              accessibilityRole="button"
                              accessibilityLabel={`Edit ${baby.name}`}
                            >
                              <Ionicons name="create-outline" size={16} color={theme.colors.textPrimary} />
                            </Pressable>
                            <Pressable
                              style={[styles.inlineDeleteBtn, { borderColor: theme.colors.error, backgroundColor: theme.colors.surfaceAlt }]}
                              onPress={() => {
                                void deleteBabyProfile(baby.id, baby.name);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={`Delete ${baby.name}`}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color={pendingDeleteBabyId === baby.id ? theme.colors.error : theme.colors.textSecondary}
                              />
                            </Pressable>
                          </View>
                        </View>
                        {!isActive ? <Text style={[styles.accountMeta, { color: theme.colors.textMuted }]}>Tap to switch</Text> : null}
                      </View>
                    </Pressable>
                    {isActive ? <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} /> : null}
                  </View>

                  {editingBabyId === baby.id ? (
                    <View style={[styles.profileEditWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }]}>
                      <View style={styles.photoEditRow}>
                        <View style={[styles.editPhotoPreview, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                          {editPhotoUri ? (
                            <Image source={{ uri: editPhotoUri }} style={styles.editPhotoPreviewImage} />
                          ) : (
                            <Text style={[styles.editPhotoFallback, { color: theme.colors.textSecondary }]}>
                              {initial}
                            </Text>
                          )}
                        </View>
                        <View style={styles.photoEditActions}>
                          <Button title={editPhotoUri ? 'Change photo' : 'Add photo'} size="sm" variant="secondary" onPress={pickBabyPhoto} />
                          {editPhotoUri ? <Button title="Remove" size="sm" variant="outline" onPress={() => setEditPhotoUri(null)} /> : null}
                        </View>
                      </View>
                      <Input
                        value={editBabyName}
                        onChangeText={(value) => {
                          setEditBabyName(value);
                          clearFieldError('editBabyName');
                        }}
                        placeholder="Baby name"
                        accessibilityLabel="Baby name"
                        errorText={fieldErrors.editBabyName}
                        maxLength={MAX_BABY_NAME_LENGTH}
                      />
                      <InlineSettingRow label="Birthdate available" styles={styles}>
                        <Switch value={editHasBirthdate} onValueChange={setEditHasBirthdate} />
                      </InlineSettingRow>
                      {editHasBirthdate ? (
                        <InlineSettingRow label="Birthdate" styles={styles}>
                          <DateTimePicker
                            value={editBirthdate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'compact' : 'default'}
                            onChange={(_, d) => d && setEditBirthdate(d)}
                          />
                        </InlineSettingRow>
                      ) : null}
                      <Input
                        value={editBirthWeight}
                        onChangeText={(value) => {
                          setEditBirthWeight(value);
                          clearFieldError('editBirthWeight');
                        }}
                        placeholder={`Birth weight (${weightUnit})`}
                        keyboardType="decimal-pad"
                        accessibilityLabel="Birth weight"
                        errorText={fieldErrors.editBirthWeight}
                      />
                      <Input
                        value={editBirthLengthCm}
                        onChangeText={(value) => {
                          setEditBirthLengthCm(value);
                          clearFieldError('editBirthLengthCm');
                        }}
                        placeholder="Birth length (cm)"
                        keyboardType="decimal-pad"
                        accessibilityLabel="Birth length"
                        errorText={fieldErrors.editBirthLengthCm}
                      />
                      <Input
                        value={editBirthHeadCm}
                        onChangeText={(value) => {
                          setEditBirthHeadCm(value);
                          clearFieldError('editBirthHeadCm');
                        }}
                        placeholder="Birth head circumference (cm)"
                        keyboardType="decimal-pad"
                        accessibilityLabel="Birth head circumference"
                        errorText={fieldErrors.editBirthHeadCm}
                      />
                      <View style={styles.profileActionRow}>
                        <Button title="Save" onPress={applyBabyProfile} />
                        <Button
                          title="Cancel"
                          variant="secondary"
                          onPress={() => {
                            setEditingBabyId(null);
                            setFieldErrors({});
                          }}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
          <View style={styles.buttonGroup}>
            <Button title="Add New Baby" variant="secondary" onPress={() => navigation.navigate('BabyOnboarding', { mode: 'new' })} />
          </View>
        </CollapsibleCard>

        {toast ? <InlineMessage kind={toast.kind} message={toast.message} /> : null}

        <CollapsibleCard title="Units" expanded={expandedSections.units} onToggle={() => toggleSection('units')} styles={styles}>
          <View style={styles.inlineUnitRow}>
            <Text style={[styles.inlineUnitLabel, { color: theme.colors.textPrimary }]}>Amount unit</Text>
            <View style={styles.inlineUnitOptions}>
              <SelectPill label="ml" selected={amountUnit === 'ml'} onPress={() => updateAmountUnit('ml')} />
              <SelectPill label="oz" selected={amountUnit === 'oz'} onPress={() => updateAmountUnit('oz')} />
            </View>
          </View>

          <View style={styles.inlineUnitRow}>
            <Text style={[styles.inlineUnitLabel, { color: theme.colors.textPrimary }]}>Weight unit</Text>
            <View style={styles.inlineUnitOptions}>
              <SelectPill label="kg" selected={weightUnit === 'kg'} onPress={() => updateWeightUnit('kg')} />
              <SelectPill label="lb" selected={weightUnit === 'lb'} onPress={() => updateWeightUnit('lb')} />
            </View>
          </View>

          <View style={styles.inlineUnitRow}>
            <Text style={[styles.inlineUnitLabel, { color: theme.colors.textPrimary }]}>Temperature unit</Text>
            <View style={styles.inlineUnitOptions}>
              <SelectPill label="F" selected={tempUnit === 'f'} onPress={() => updateTempUnit('f')} />
              <SelectPill label="C" selected={tempUnit === 'c'} onPress={() => updateTempUnit('c')} />
            </View>
          </View>
        </CollapsibleCard>

        <CollapsibleCard
          title="Reminders"
          expanded={expandedSections.reminders}
          onToggle={() => toggleSection('reminders')}
          styles={styles}
        >
          <Row>
            <Ionicons name="alarm-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>Feeding reminders and smart alerts</Text>
          </Row>

          <InlineSettingRow label="Enable reminders" styles={styles}>
            <Switch value={reminderSettings.enabled} onValueChange={applyReminderSettings} />
          </InlineSettingRow>

          <InlineSettingRow label="Interval hours" styles={styles}>
            <Input
              value={intervalHours}
              onChangeText={(value) => {
                setIntervalHours(value);
                clearFieldError('intervalHours');
              }}
              keyboardType="number-pad"
              style={styles.compactInlineInput}
              errorText={fieldErrors.intervalHours}
            />
          </InlineSettingRow>

          <InlineSettingRow label="Enable smart alerts" styles={styles}>
            <Switch value={smartAlertSettings.enabled} onValueChange={toggleSmartAlerts} />
          </InlineSettingRow>

          <InlineSettingRow label="Feed gap warning (hours)" styles={styles}>
            <Input
              value={feedGapHours}
              onChangeText={(value) => {
                setFeedGapHours(value);
                clearFieldError('feedGapHours');
              }}
              keyboardType="decimal-pad"
              style={styles.compactInlineInput}
              errorText={fieldErrors.feedGapHours}
            />
          </InlineSettingRow>
        </CollapsibleCard>

        <CollapsibleCard title="Auto Backup" expanded={expandedSections.backup} onToggle={() => toggleSection('backup')} styles={styles}>
          <Row>
            <Ionicons name="cloud-upload-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>Scheduled export backup</Text>
          </Row>

          <InlineSettingRow label="Enable automatic backup" styles={styles}>
            <Switch value={backupSettings.enabled} onValueChange={toggleAutoBackup} />
          </InlineSettingRow>

          <View style={styles.destinationRow}>
            <Label style={styles.destinationLabel}>Destination</Label>
            <View style={[styles.destinationOptionsRow, bothBackupProvidersConnected ? styles.destinationOptionsRowCompact : null]}>
              <SelectPill
                label="Share"
                size={bothBackupProvidersConnected ? 'sm' : 'md'}
                selected={backupSettings.destination === 'share'}
                onPress={() => setBackupDestination('share')}
              />
              <SelectPill
                label={driveConnected ? 'Drive ✓' : 'Drive'}
                size={bothBackupProvidersConnected ? 'sm' : 'md'}
                selected={backupSettings.destination === 'google_drive'}
                onPress={() => setBackupDestination('google_drive')}
              />
              <SelectPill
                label={dropboxConnected ? 'Dropbox ✓' : 'Dropbox'}
                size={bothBackupProvidersConnected ? 'sm' : 'md'}
                selected={backupSettings.destination === 'dropbox'}
                onPress={() => setBackupDestination('dropbox')}
              />
            </View>
          </View>

          <InlineSettingRow label="Backup interval (days)" styles={styles}>
            <Input
              value={backupIntervalDays}
              onChangeText={(value) => {
                setBackupIntervalDays(value);
                clearFieldError('backupIntervalDays');
              }}
              keyboardType="number-pad"
              style={styles.compactInlineInput}
              errorText={fieldErrors.backupIntervalDays}
            />
          </InlineSettingRow>

          <InlineSettingRow label="Last backup" styles={styles}>
            <Text style={[styles.inlineValueText, { color: theme.colors.textPrimary }]}>
              {backupSettings.lastBackupAt ? formatDateTime(backupSettings.lastBackupAt) : 'Never'}
            </Text>
          </InlineSettingRow>

          <View style={styles.buttonGroup}>
            <Button title="Run Backup Now" onPress={onRunBackupNow} />
          </View>
        </CollapsibleCard>

        <CollapsibleCard title="Account" expanded={expandedSections.account} onToggle={() => toggleSection('account')} styles={styles}>
          <Text style={[styles.signedInLine, { color: theme.colors.textSecondary }]}>
            Signed in: <Text style={[styles.signedInEmail, { color: theme.colors.textPrimary }]}>{session ? session.user.email : 'Not signed in'}</Text>
          </Text>

          <View style={styles.buttonGroup}>
            {session ? (
              <Button
                title={deletingAccount ? 'Deleting Account...' : pendingDeleteAccount ? 'Tap Again to Delete My Account' : 'Delete My Account'}
                variant="danger"
                onPress={onDeleteAccount}
                disabled={deletingAccount}
              />
            ) : null}
            {session ? <Button title="Sign Out" variant="danger" onPress={onSignOut} disabled={deletingAccount} /> : null}
          </View>
        </CollapsibleCard>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    safe: {
      flex: 1,
    },
    content: {
      padding: theme.spacing[4],
      gap: theme.spacing[2],
      paddingBottom: theme.spacing[8],
    },
    compactCard: {
      marginBottom: 0,
      paddingVertical: theme.spacing[2],
    },
    sectionHeaderRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 0,
    },
    sectionHeaderTitle: {
      ...theme.typography.h6,
      fontWeight: '700',
    },
    sectionBody: {
      marginTop: theme.spacing[2],
      paddingTop: theme.spacing[3],
      borderTopWidth: 1,
    },
    sectionSub: {
      ...theme.typography.caption,
      marginBottom: theme.spacing[2],
    },
    inlineSettingRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing[2],
      marginBottom: theme.spacing[2],
    },
    inlineSettingLabel: {
      marginBottom: 0,
      flex: 1,
    },
    inlineControlWrap: {
      flexShrink: 1,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    inlineUnitRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing[2],
      marginBottom: theme.spacing[2],
    },
    inlineUnitLabel: {
      ...theme.typography.bodySm,
      fontWeight: '600',
      flex: 1,
    },
    inlineUnitOptions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[1],
      flexShrink: 0,
    },
    inlineUnitOptionsWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[1],
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      maxWidth: 220,
    },
    destinationRow: {
      marginBottom: theme.spacing[2],
      gap: theme.spacing[1],
    },
    destinationLabel: {
      marginBottom: 0,
    },
    destinationOptionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[1],
      flexWrap: 'nowrap',
    },
    destinationOptionsRowCompact: {
      justifyContent: 'space-between',
      gap: theme.spacing[0],
    },
    compactInlineInput: {
      width: 100,
      minHeight: 44,
      textAlign: 'right',
    },
    inlineValueText: {
      ...theme.typography.bodySm,
      fontWeight: '600',
      textAlign: 'right',
    },
    buttonGroup: {
      marginTop: theme.spacing[2],
      gap: theme.spacing[2],
    },
    accountList: {
      gap: theme.spacing[2],
      marginBottom: theme.spacing[2],
    },
    accountItemWrap: {
      paddingHorizontal: 0,
      paddingVertical: theme.spacing[2],
    },
    accountLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
      flex: 1,
    },
    accountInfoWrap: {
      flex: 1,
    },
    accountNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing[2],
    },
    inlineBabyActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[1],
    },
    inlineEditBtn: {
      width: 30,
      height: 30,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inlineDeleteBtn: {
      width: 30,
      height: 30,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    accountAvatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 19,
    },
    accountAvatarText: {
      ...theme.typography.bodySm,
      fontWeight: '800',
    },
    accountItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 44,
    },
    profileActionRow: {
      marginTop: theme.spacing[2],
      flexDirection: 'row',
      gap: theme.spacing[2],
    },
    profileEditWrap: {
      marginTop: theme.spacing[2],
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.spacing[3],
      gap: theme.spacing[2],
    },
    photoEditRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
    },
    editPhotoPreview: {
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    editPhotoPreviewImage: {
      width: '100%',
      height: '100%',
      borderRadius: 26,
    },
    editPhotoFallback: {
      ...theme.typography.h6,
      fontWeight: '800',
    },
    photoEditActions: {
      flexDirection: 'row',
      gap: theme.spacing[2],
      flexWrap: 'wrap',
    },
    accountItemSeparator: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    accountName: {
      ...theme.typography.body,
      fontWeight: '700',
    },
    accountMeta: {
      ...theme.typography.caption,
      marginTop: theme.spacing[1],
    },
    signedInLine: {
      ...theme.typography.bodySm,
      marginTop: theme.spacing[4],
      marginBottom: theme.spacing[1],
    },
    signedInEmail: {
      ...theme.typography.bodySm,
      fontWeight: '700',
    },
  });
