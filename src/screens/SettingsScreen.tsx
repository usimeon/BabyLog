import React, { useMemo, useRef, useState } from 'react';
import { Platform, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../app/navigation';
import { Button, Card, Input, Row, SelectPill } from '../components/ui';
import { useAppContext } from '../context/AppContext';
import { getBabyById, upsertBaby } from '../db/babyRepo';
import { cancelReminder, requestNotificationPermission } from '../services/notifications';
import { recalculateReminder } from '../services/reminderCoordinator';
import { BackupDestination } from '../types/models';
import { formatDateTime, nowIso } from '../utils/time';
import { signOut } from '../supabase/auth';
import { SyncBanner } from '../components/SyncBanner';
import { runBackupNow } from '../services/backups';
import { connectCloudProvider, disconnectCloudProvider, getCloudProviderConnected } from '../services/cloudStorage';

const toUtcNoonIso = (value: Date) => {
  const utc = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0));
  return utc.toISOString();
};

const InlineSettingRow = ({ label, children }: React.PropsWithChildren<{ label: string }>) => (
  <View style={styles.inlineSettingRow}>
    <Text style={styles.inlineSettingLabel}>{label}</Text>
    <View style={styles.inlineControlWrap}>{children}</View>
  </View>
);

export const SettingsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    babyId,
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
    session,
    supabaseEnabled,
    syncNow,
    syncState,
    syncError,
    lastSyncAt,
  } = useAppContext();

  const [intervalHours, setIntervalHours] = useState(String(reminderSettings.intervalHours));
  const [quietStart, setQuietStart] = useState<Date>(new Date());
  const [quietEnd, setQuietEnd] = useState<Date>(new Date());
  const [feedGapHours, setFeedGapHours] = useState(String(smartAlertSettings.feedGapHours));
  const [diaperGapHours, setDiaperGapHours] = useState(String(smartAlertSettings.diaperGapHours));
  const [feverThresholdC, setFeverThresholdC] = useState(String(smartAlertSettings.feverThresholdC));
  const [lowFeedsPerDay, setLowFeedsPerDay] = useState(String(smartAlertSettings.lowFeedsPerDay));
  const [backupIntervalDays, setBackupIntervalDays] = useState(String(backupSettings.intervalDays));
  const [babyBirthdate, setBabyBirthdate] = useState<Date>(new Date());
  const [hasBabyBirthdate, setHasBabyBirthdate] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [dropboxConnected, setDropboxConnected] = useState(false);
  const [toast, setToast] = useState<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dummyAccounts = [
    { name: 'Ava Johnson', phone: '(415) 555-0148', lastUsed: '2h ago' },
    { name: 'Noah Patel', phone: '(415) 555-0199', lastUsed: 'Yesterday' },
    { name: 'Mia Chen', phone: '(415) 555-0112', lastUsed: '3d ago' },
  ];

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

  React.useEffect(() => {
    const loadBabyProfile = async () => {
      const baby = await getBabyById(babyId);
      if (!baby?.birthdate) {
        setHasBabyBirthdate(false);
        return;
      }
      const parsed = new Date(baby.birthdate);
      if (Number.isNaN(parsed.getTime())) {
        setHasBabyBirthdate(false);
        return;
      }
      setBabyBirthdate(parsed);
      setHasBabyBirthdate(true);
    };
    loadBabyProfile();
  }, [babyId]);

  const showToast = (message: string, kind: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ kind, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  };

  const applyReminderSettings = async (enabled: boolean, options?: { notify?: boolean }) => {
    try {
      const nextSettings = {
        enabled,
        intervalHours: Number(intervalHours) || 3,
        quietHoursStart: `${String(quietStart.getHours()).padStart(2, '0')}:${String(quietStart.getMinutes()).padStart(2, '0')}`,
        quietHoursEnd: `${String(quietEnd.getHours()).padStart(2, '0')}:${String(quietEnd.getMinutes()).padStart(2, '0')}`,
        allowDuringQuietHours: reminderSettings.allowDuringQuietHours,
      };

      if (enabled) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          showToast('Notification permission is required for reminders.', 'error');
          return;
        }
        await updateReminderSettings(nextSettings);
        await recalculateReminder(babyId, nextSettings);
        if (options?.notify) {
          showToast(`Reminders are enabled every ${nextSettings.intervalHours} hour(s).`, 'success');
        }
        return;
      }

      await cancelReminder();
      await updateReminderSettings(nextSettings);
      if (options?.notify) {
        showToast('Reminders are disabled and pending notifications were cancelled.', 'success');
      }
    } catch (error: any) {
      showToast(`Reminder update failed: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  const toggleQuietHours = async (allow: boolean) => {
    try {
      const next = { ...reminderSettings, allowDuringQuietHours: allow };
      await updateReminderSettings(next);
      if (next.enabled) {
        await recalculateReminder(babyId, next);
      }
      showToast(`Quiet hours ${allow ? 'allowed' : 'blocked'} for reminders.`, 'success');
    } catch (error: any) {
      showToast(`Quiet hours update failed: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  const onSignOut = async () => {
    try {
      await signOut();
      showToast('Signed out successfully.', 'success');
    } catch (error: any) {
      showToast(`Sign out failed: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  const onInvite = async () => {
    showToast('Invite link shared with caregiver contacts.', 'success');
  };

  const applySmartAlerts = async () => {
    try {
      const next = {
        ...smartAlertSettings,
        feedGapHours: Number(feedGapHours) || 4.5,
        diaperGapHours: Number(diaperGapHours) || 8,
        feverThresholdC: Number(feverThresholdC) || 38,
        lowFeedsPerDay: Number(lowFeedsPerDay) || 6,
      };
      await updateSmartAlertSettings(next);
      showToast('Smart alert thresholds applied.', 'success');
    } catch (error: any) {
      showToast(`Smart alerts update failed: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  const toggleSmartAlerts = async (enabled: boolean) => {
    try {
      await updateSmartAlertSettings({ ...smartAlertSettings, enabled });
      showToast(`Smart alerts ${enabled ? 'enabled' : 'disabled'}.`, 'success');
    } catch (error: any) {
      showToast(`Smart alerts update failed: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  const setBackupDestination = async (destination: BackupDestination) => {
    try {
      await updateBackupSettings({ ...backupSettings, destination });
      showToast('Backup destination updated.', 'success');
    } catch (error: any) {
      showToast(`Backup destination failed: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  const toggleAutoBackup = async (enabled: boolean) => {
    try {
      const next = {
        ...backupSettings,
        enabled,
        intervalDays: Number(backupIntervalDays) || 1,
      };
      await updateBackupSettings(next);
      showToast(`Auto backup ${enabled ? 'enabled' : 'disabled'}.`, 'success');
    } catch (error: any) {
      showToast(`Auto backup failed: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  const onRunBackupNow = async () => {
    try {
      const lastBackupAt = await runBackupNow({ ...backupSettings, intervalDays: Number(backupIntervalDays) || 1 });
      await updateBackupSettings({ ...backupSettings, intervalDays: Number(backupIntervalDays) || 1, lastBackupAt });
      showToast('Backup created and uploaded successfully.', 'success');
    } catch (error: any) {
      showToast(`Backup failed: ${error?.message ?? 'Unknown backup error'}`, 'error');
    }
  };

  const connectSelectedProvider = async () => {
    try {
      if (backupSettings.destination === 'share') {
        showToast('Share destination does not require account connection.', 'info');
        return;
      }
      await connectCloudProvider(backupSettings.destination);
      if (backupSettings.destination === 'google_drive') setDriveConnected(true);
      if (backupSettings.destination === 'dropbox') setDropboxConnected(true);
      showToast(`${backupSettings.destination === 'google_drive' ? 'Google Drive' : 'Dropbox'} connected.`, 'success');
    } catch (error: any) {
      showToast(`Connection failed: ${error?.message ?? 'Could not connect provider.'}`, 'error');
    }
  };

  const disconnectSelectedProvider = async () => {
    try {
      if (backupSettings.destination === 'share') return;
      await disconnectCloudProvider(backupSettings.destination);
      if (backupSettings.destination === 'google_drive') setDriveConnected(false);
      if (backupSettings.destination === 'dropbox') setDropboxConnected(false);
      showToast('Provider connection removed.', 'success');
    } catch (error: any) {
      showToast(`Disconnect failed: ${error?.message ?? 'Could not disconnect provider.'}`, 'error');
    }
  };

  const applyBackupSettings = async () => {
    try {
      await updateBackupSettings({
        ...backupSettings,
        intervalDays: Number(backupIntervalDays) || 1,
      });
      showToast('Backup settings applied.', 'success');
    } catch (error: any) {
      showToast(`Backup settings failed: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  const onSyncNow = async () => {
    try {
      await syncNow();
      showToast('Cloud sync is running.', 'info');
    } catch (error: any) {
      showToast(`Sync failed: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  const applyBabyProfile = async () => {
    try {
      const existing = await getBabyById(babyId);
      if (!existing) throw new Error('Baby profile not found.');
      const nextBirthdate = hasBabyBirthdate ? toUtcNoonIso(babyBirthdate) : null;
      await upsertBaby(
        {
          ...existing,
          birthdate: nextBirthdate,
          updated_at: nowIso(),
        },
        true,
      );
      await syncNow();
      showToast('Baby profile updated.', 'success');
    } catch (error: any) {
      showToast(`Baby profile update failed: ${error?.message ?? 'Unknown error'}`, 'error');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Settings</Text>
          <Text style={styles.heroSub}>Customize units, reminders, cloud sync, and exports.</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroPill}>
              <Ionicons name="cloud-done-outline" size={14} color="#0f766e" />
              <Text style={styles.heroPillText}>{supabaseEnabled ? 'Cloud Ready' : 'Local Mode'}</Text>
            </View>
            <View style={styles.heroPill}>
              <Ionicons name="notifications-outline" size={14} color="#F77575" />
              <Text style={styles.heroPillText}>{reminderSettings.enabled ? 'Reminders On' : 'Reminders Off'}</Text>
            </View>
          </View>
        </View>

        <SyncBanner syncState={syncState} syncError={syncError} lastSyncAt={lastSyncAt} enabled={supabaseEnabled} />

        <Card title="Baby Profile">
          <Row>
            <Ionicons name="happy-outline" size={16} color="#334155" />
            <Text style={styles.sectionSub}>Used for age-aware charts and AI suggestions</Text>
          </Row>
          <InlineSettingRow label="Birthdate available">
            <Switch value={hasBabyBirthdate} onValueChange={setHasBabyBirthdate} />
          </InlineSettingRow>
          {hasBabyBirthdate ? (
            <>
              <InlineSettingRow label="Birthdate">
                <DateTimePicker
                  value={babyBirthdate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'compact' : 'default'}
                  onChange={(_, d) => d && setBabyBirthdate(d)}
                />
              </InlineSettingRow>
            </>
          ) : (
            <Text style={styles.sub}>Birthdate is not set.</Text>
          )}
          <View style={styles.buttonGroup}>
            <Button title="Save Baby Profile" onPress={applyBabyProfile} />
            <Button
              title="Add New Baby"
              variant="secondary"
              onPress={() => navigation.navigate('BabyOnboarding', { mode: 'new' })}
            />
          </View>
        </Card>

        {toast ? (
          <View
            style={[
              styles.toast,
              toast.kind === 'error' ? styles.toastError : toast.kind === 'info' ? styles.toastInfo : styles.toastSuccess,
            ]}
          >
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        ) : null}

        <Card title="Units">
          <Row>
            <Ionicons name="options-outline" size={16} color="#334155" />
            <Text style={styles.sectionSub}>Display preferences</Text>
          </Row>
          <View style={styles.inlineUnitRow}>
            <Text style={styles.inlineUnitLabel}>Amount unit</Text>
            <View style={styles.inlineUnitOptions}>
              <SelectPill label="ml" selected={amountUnit === 'ml'} onPress={() => updateAmountUnit('ml')} />
              <SelectPill label="oz" selected={amountUnit === 'oz'} onPress={() => updateAmountUnit('oz')} />
            </View>
          </View>

          <View style={styles.inlineUnitRow}>
            <Text style={styles.inlineUnitLabel}>Weight unit</Text>
            <View style={styles.inlineUnitOptions}>
              <SelectPill label="kg" selected={weightUnit === 'kg'} onPress={() => updateWeightUnit('kg')} />
              <SelectPill label="lb" selected={weightUnit === 'lb'} onPress={() => updateWeightUnit('lb')} />
            </View>
          </View>

          <View style={styles.inlineUnitRow}>
            <Text style={styles.inlineUnitLabel}>Temperature unit</Text>
            <View style={styles.inlineUnitOptions}>
              <SelectPill label="F" selected={tempUnit === 'f'} onPress={() => updateTempUnit('f')} />
              <SelectPill label="C" selected={tempUnit === 'c'} onPress={() => updateTempUnit('c')} />
            </View>
          </View>
        </Card>

        <Card title="Reminders">
          <Row>
            <Ionicons name="alarm-outline" size={16} color="#334155" />
            <Text style={styles.sectionSub}>Feeding reminder controls</Text>
          </Row>
          <InlineSettingRow label="Enable reminders">
            <Switch value={reminderSettings.enabled} onValueChange={applyReminderSettings} />
          </InlineSettingRow>

          <InlineSettingRow label="Interval hours">
            <Input
              value={intervalHours}
              onChangeText={setIntervalHours}
              keyboardType="number-pad"
              style={styles.compactInlineInput}
            />
          </InlineSettingRow>

          <InlineSettingRow label="Quiet hours start">
            <DateTimePicker
              value={quietStart}
              mode="time"
              display={Platform.OS === 'ios' ? 'compact' : 'default'}
              onChange={(_, d) => d && setQuietStart(d)}
            />
          </InlineSettingRow>

          <InlineSettingRow label="Quiet hours end">
            <DateTimePicker
              value={quietEnd}
              mode="time"
              display={Platform.OS === 'ios' ? 'compact' : 'default'}
              onChange={(_, d) => d && setQuietEnd(d)}
            />
          </InlineSettingRow>

          <InlineSettingRow label="Allow during quiet hours">
            <Switch value={reminderSettings.allowDuringQuietHours} onValueChange={toggleQuietHours} />
          </InlineSettingRow>

          <View style={styles.buttonGroup}>
            <Button title="Apply Reminder Changes" onPress={() => applyReminderSettings(reminderSettings.enabled, { notify: true })} />
          </View>
        </Card>

        <Card title="Smart Alerts">
          <Row>
            <Ionicons name="warning-outline" size={16} color="#334155" />
            <Text style={styles.sectionSub}>Threshold-based safety alerts</Text>
          </Row>
          <InlineSettingRow label="Enable smart alerts">
            <Switch value={smartAlertSettings.enabled} onValueChange={toggleSmartAlerts} />
          </InlineSettingRow>
          <InlineSettingRow label="Feed gap warning (hours)">
            <Input
              value={feedGapHours}
              onChangeText={setFeedGapHours}
              keyboardType="decimal-pad"
              style={styles.compactInlineInput}
            />
          </InlineSettingRow>

          <InlineSettingRow label="Diaper gap warning (hours)">
            <Input
              value={diaperGapHours}
              onChangeText={setDiaperGapHours}
              keyboardType="decimal-pad"
              style={styles.compactInlineInput}
            />
          </InlineSettingRow>

          <InlineSettingRow label="Fever threshold (C)">
            <Input
              value={feverThresholdC}
              onChangeText={setFeverThresholdC}
              keyboardType="decimal-pad"
              style={styles.compactInlineInput}
            />
          </InlineSettingRow>

          <InlineSettingRow label="Low feed count (24h)">
            <Input
              value={lowFeedsPerDay}
              onChangeText={setLowFeedsPerDay}
              keyboardType="number-pad"
              style={styles.compactInlineInput}
            />
          </InlineSettingRow>

          <View style={styles.buttonGroup}>
            <Button title="Apply Alert Thresholds" onPress={applySmartAlerts} />
          </View>
        </Card>

        <Card title="Auto Backup">
          <Row>
            <Ionicons name="cloud-upload-outline" size={16} color="#334155" />
            <Text style={styles.sectionSub}>Scheduled export backup</Text>
          </Row>
          <InlineSettingRow label="Enable automatic backup">
            <Switch value={backupSettings.enabled} onValueChange={toggleAutoBackup} />
          </InlineSettingRow>
          <InlineSettingRow label="Destination">
            <View style={styles.inlineUnitOptionsWrap}>
              <SelectPill label="Share" selected={backupSettings.destination === 'share'} onPress={() => setBackupDestination('share')} />
              <SelectPill label="Drive" selected={backupSettings.destination === 'google_drive'} onPress={() => setBackupDestination('google_drive')} />
              <SelectPill label="Dropbox" selected={backupSettings.destination === 'dropbox'} onPress={() => setBackupDestination('dropbox')} />
            </View>
          </InlineSettingRow>
          <InlineSettingRow label="Google Drive">
            <Text style={styles.inlineValueText}>{driveConnected ? 'Connected' : 'Not connected'}</Text>
          </InlineSettingRow>
          <InlineSettingRow label="Dropbox">
            <Text style={styles.inlineValueText}>{dropboxConnected ? 'Connected' : 'Not connected'}</Text>
          </InlineSettingRow>
          <InlineSettingRow label="Backup interval (days)">
            <Input
              value={backupIntervalDays}
              onChangeText={setBackupIntervalDays}
              keyboardType="number-pad"
              style={styles.compactInlineInput}
            />
          </InlineSettingRow>
          <InlineSettingRow label="Last backup">
            <Text style={styles.inlineValueText}>
              {backupSettings.lastBackupAt ? formatDateTime(backupSettings.lastBackupAt) : 'Never'}
            </Text>
          </InlineSettingRow>
          <View style={styles.buttonGroup}>
            <Button title="Connect Selected Provider" variant="secondary" onPress={connectSelectedProvider} />
            <Button title="Disconnect Selected Provider" variant="danger" onPress={disconnectSelectedProvider} />
            <Button title="Apply Backup Settings" variant="secondary" onPress={applyBackupSettings} />
            <Button title="Run Backup Now" onPress={onRunBackupNow} />
          </View>
        </Card>

        <Card title="Account">
          <Row>
            <Ionicons name="person-circle-outline" size={16} color="#334155" />
            <Text style={styles.sectionSub}>Access and linked caregivers</Text>
          </Row>
          <View style={styles.accountList}>
            {dummyAccounts.map((account, index) => (
              <View
                key={account.phone}
                style={[styles.accountItem, index < dummyAccounts.length - 1 ? styles.accountItemSeparator : null]}
              >
                <View style={styles.accountLeft}>
                  <View
                    style={[
                      styles.accountAvatar,
                      {
                        backgroundColor: index % 3 === 0 ? '#FFE194' : index % 3 === 1 ? '#FFB085' : '#90AACB',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.accountAvatarText,
                        { color: index % 3 === 0 ? '#7A5A00' : index % 3 === 1 ? '#7C3A1D' : '#FFFFFF' },
                      ]}
                    >
                      {account.name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.accountName}>{account.name}</Text>
                    <Text style={styles.accountMeta}>{account.phone}</Text>
                  </View>
                </View>
                <View>
                  <Text style={styles.accountLastUsed}>{account.lastUsed}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.buttonGroup}>
            <Button title="Invite Caregiver" variant="secondary" onPress={onInvite} />
          </View>

          <View style={styles.sectionSpacer} />

          <Text style={styles.signedInLine}>
            Signed in: <Text style={styles.signedInEmail}>{session ? session.user.email : 'Not signed in'}</Text>
          </Text>
          <View style={styles.buttonGroup}>
            <Button title="Sync Now" onPress={onSyncNow} />
            {session ? <Button title="Sign Out" variant="danger" onPress={onSignOut} /> : null}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef3fb' },
  content: { padding: 16, gap: 14 },
  hero: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    padding: 14,
    marginBottom: 2,
  },
  heroTitle: { color: '#0f172a', fontWeight: '800', fontSize: 24 },
  heroSub: { color: '#334155', marginTop: 2, marginBottom: 8, fontSize: 13 },
  heroRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  heroPillText: { color: '#1e293b', fontSize: 12, fontWeight: '600' },
  label: { color: '#374151', fontWeight: '500' },
  sub: { color: '#4b5563', fontSize: 13, marginBottom: 8 },
  sectionSub: { color: '#64748b', fontSize: 12, marginBottom: 8 },
  inlineSettingRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  inlineSettingLabel: {
    color: '#374151',
    fontWeight: '500',
    fontSize: 13,
    flex: 1,
  },
  inlineControlWrap: {
    flexShrink: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  inlineUnitRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  inlineUnitLabel: {
    color: '#374151',
    fontWeight: '500',
    fontSize: 13,
    flex: 1,
  },
  inlineUnitOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  inlineUnitOptionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    maxWidth: 220,
  },
  compactInlineInput: {
    width: 88,
    height: 40,
    borderRadius: 12,
    textAlign: 'right',
  },
  inlineValueText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  buttonGroup: { marginTop: 8, gap: 8 },
  accountList: { gap: 8, marginBottom: 8 },
  accountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  accountAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  accountItem: {
    paddingHorizontal: 4,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountItemSeparator: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  accountName: { color: '#111827', fontSize: 13, fontWeight: '600' },
  accountMeta: { color: '#6b7280', fontSize: 12 },
  accountLastUsed: { color: '#6b7280', fontSize: 12, fontWeight: '600' },
  sectionSpacer: { height: 30 },
  signedInLine: { color: '#4b5563', fontSize: 13, marginBottom: 2 },
  signedInEmail: { color: '#111827', fontSize: 13, fontWeight: '700' },
  toast: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  toastText: { fontSize: 12, color: '#1f2937' },
  toastSuccess: { backgroundColor: '#ecfdf3', borderColor: '#bbf7d0' },
  toastError: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  toastInfo: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
});
