import React, { useMemo, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input, Label, Row, SelectPill } from '../components/ui';
import { useAppContext } from '../context/AppContext';
import { cancelReminder, requestNotificationPermission } from '../services/notifications';
import { recalculateReminder } from '../services/reminderCoordinator';
import { exportExcel, exportPdf } from '../services/exports';
import { BackupDestination, DateRange } from '../types/models';
import { presetDateRange } from '../utils/dateRange';
import { formatDateTime } from '../utils/time';
import { signOut } from '../supabase/auth';
import { SyncBanner } from '../components/SyncBanner';
import { runBackupNow } from '../services/backups';

export const SettingsScreen = () => {
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
  const [rangePreset, setRangePreset] = useState<'7d' | '30d' | 'custom'>('7d');
  const [customStart, setCustomStart] = useState(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const [customEnd, setCustomEnd] = useState(new Date());
  const [feedGapHours, setFeedGapHours] = useState(String(smartAlertSettings.feedGapHours));
  const [diaperGapHours, setDiaperGapHours] = useState(String(smartAlertSettings.diaperGapHours));
  const [feverThresholdC, setFeverThresholdC] = useState(String(smartAlertSettings.feverThresholdC));
  const [lowFeedsPerDay, setLowFeedsPerDay] = useState(String(smartAlertSettings.lowFeedsPerDay));
  const [backupIntervalDays, setBackupIntervalDays] = useState(String(backupSettings.intervalDays));
  const [toast, setToast] = useState<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dummyAccounts = [
    { name: 'Ava Johnson', phone: '(415) 555-0148', lastUsed: '2h ago' },
    { name: 'Noah Patel', phone: '(415) 555-0199', lastUsed: 'Yesterday' },
    { name: 'Mia Chen', phone: '(415) 555-0112', lastUsed: '3d ago' },
  ];

  const dateRange: DateRange = useMemo(() => {
    if (rangePreset === 'custom') {
      return {
        start: customStart,
        end: customEnd,
        label: 'Custom',
      };
    }

    return presetDateRange(rangePreset);
  }, [rangePreset, customStart, customEnd]);

  const showToast = (message: string, kind: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ kind, message });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const applyReminderSettings = async (enabled: boolean) => {
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
        showToast('Reminder settings applied.', 'success');
        return;
      }

      await cancelReminder();
      await updateReminderSettings(nextSettings);
      showToast('Reminders turned off.', 'success');
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

  const runExport = async (kind: 'pdf' | 'excel') => {
    try {
      if (kind === 'pdf') {
        await exportPdf(dateRange);
      } else {
        await exportExcel(dateRange);
      }
      showToast(`${kind === 'pdf' ? 'PDF' : 'Excel'} export is ready to share.`, 'success');
    } catch (error: any) {
      showToast(`Export failed: ${error?.message ?? 'Unknown export error'}`, 'error');
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
      showToast('Backup created and shared successfully.', 'success');
    } catch (error: any) {
      showToast(`Backup failed: ${error?.message ?? 'Unknown backup error'}`, 'error');
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

        <SyncBanner
          syncState={syncState}
          syncError={syncError}
          lastSyncAt={lastSyncAt}
          enabled={supabaseEnabled}
        />
        {toast ? (
          <View style={[styles.toast, toast.kind === 'error' ? styles.toastError : toast.kind === 'info' ? styles.toastInfo : styles.toastSuccess]}>
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        ) : null}
        <Card title="Units">
          <Row>
            <Ionicons name="options-outline" size={16} color="#334155" />
            <Text style={styles.sectionSub}>Display preferences</Text>
          </Row>
          <Label>Amount unit</Label>
          <Row>
            <SelectPill label="ml" selected={amountUnit === 'ml'} onPress={() => updateAmountUnit('ml')} />
            <SelectPill label="oz" selected={amountUnit === 'oz'} onPress={() => updateAmountUnit('oz')} />
          </Row>

          <Label>Weight unit</Label>
          <Row>
            <SelectPill label="kg" selected={weightUnit === 'kg'} onPress={() => updateWeightUnit('kg')} />
            <SelectPill label="lb" selected={weightUnit === 'lb'} onPress={() => updateWeightUnit('lb')} />
          </Row>

          <Label>Temperature unit</Label>
          <Row>
            <SelectPill label="F" selected={tempUnit === 'f'} onPress={() => updateTempUnit('f')} />
            <SelectPill label="C" selected={tempUnit === 'c'} onPress={() => updateTempUnit('c')} />
          </Row>
        </Card>

        <Card title="Reminders">
          <Row>
            <Ionicons name="alarm-outline" size={16} color="#334155" />
            <Text style={styles.sectionSub}>Feeding reminder controls</Text>
          </Row>
          <Row>
            <Text style={styles.label}>Enable reminders</Text>
            <Switch value={reminderSettings.enabled} onValueChange={applyReminderSettings} />
          </Row>

          <Label>Interval hours</Label>
          <Input value={intervalHours} onChangeText={setIntervalHours} keyboardType="number-pad" />

          <Label>Quiet hours start</Label>
          <DateTimePicker value={quietStart} mode="time" onChange={(_, d) => d && setQuietStart(d)} />

          <Label>Quiet hours end</Label>
          <DateTimePicker value={quietEnd} mode="time" onChange={(_, d) => d && setQuietEnd(d)} />

          <Row>
            <Text style={styles.label}>Allow during quiet hours</Text>
            <Switch
              value={reminderSettings.allowDuringQuietHours}
              onValueChange={toggleQuietHours}
            />
          </Row>

          <View style={styles.buttonGroup}>
            <Button title="Apply Reminder Changes" onPress={() => applyReminderSettings(reminderSettings.enabled)} />
          </View>
        </Card>

        <Card title="Smart Alerts">
          <Row>
            <Ionicons name="warning-outline" size={16} color="#334155" />
            <Text style={styles.sectionSub}>Threshold-based safety alerts</Text>
          </Row>
          <Row>
            <Text style={styles.label}>Enable smart alerts</Text>
            <Switch
              value={smartAlertSettings.enabled}
              onValueChange={toggleSmartAlerts}
            />
          </Row>
          <Label>Feed gap warning (hours)</Label>
          <Input value={feedGapHours} onChangeText={setFeedGapHours} keyboardType="decimal-pad" />

          <Label>Diaper gap warning (hours)</Label>
          <Input value={diaperGapHours} onChangeText={setDiaperGapHours} keyboardType="decimal-pad" />

          <Label>Fever threshold (C)</Label>
          <Input value={feverThresholdC} onChangeText={setFeverThresholdC} keyboardType="decimal-pad" />

          <Label>Low feed count (24h)</Label>
          <Input value={lowFeedsPerDay} onChangeText={setLowFeedsPerDay} keyboardType="number-pad" />

          <View style={styles.buttonGroup}>
            <Button title="Apply Alert Thresholds" onPress={applySmartAlerts} />
          </View>
        </Card>

        <Card title="Export">
          <Row>
            <Ionicons name="share-social-outline" size={16} color="#334155" />
            <Text style={styles.sectionSub}>Share files for selected range</Text>
          </Row>
          <Label>Date range</Label>
          <Row>
            <SelectPill label="Last 7" selected={rangePreset === '7d'} onPress={() => setRangePreset('7d')} />
            <SelectPill label="Last 30" selected={rangePreset === '30d'} onPress={() => setRangePreset('30d')} />
            <SelectPill label="Custom" selected={rangePreset === 'custom'} onPress={() => setRangePreset('custom')} />
          </Row>

          {rangePreset === 'custom' ? (
            <>
              <Label>Start</Label>
              <DateTimePicker value={customStart} mode="date" onChange={(_, d) => d && setCustomStart(d)} />
              <Label>End</Label>
              <DateTimePicker value={customEnd} mode="date" onChange={(_, d) => d && setCustomEnd(d)} />
            </>
          ) : null}

          <Text style={styles.sub}>
            Range: {formatDateTime(dateRange.start.toISOString())} - {formatDateTime(dateRange.end.toISOString())}
          </Text>

          <View style={styles.buttonGroup}>
            <Button title="Export PDF" onPress={() => runExport('pdf')} />
            <Button title="Export Excel (.xlsx)" onPress={() => runExport('excel')} variant="secondary" />
          </View>
        </Card>

        <Card title="Auto Backup">
          <Row>
            <Ionicons name="cloud-upload-outline" size={16} color="#334155" />
            <Text style={styles.sectionSub}>Scheduled export backup</Text>
          </Row>
          <Row>
            <Text style={styles.label}>Enable automatic backup</Text>
            <Switch value={backupSettings.enabled} onValueChange={toggleAutoBackup} />
          </Row>
          <Label>Destination</Label>
          <Row>
            <SelectPill label="Share" selected={backupSettings.destination === 'share'} onPress={() => setBackupDestination('share')} />
            <SelectPill
              label="Google Drive"
              selected={backupSettings.destination === 'google_drive'}
              onPress={() => setBackupDestination('google_drive')}
            />
            <SelectPill
              label="Dropbox"
              selected={backupSettings.destination === 'dropbox'}
              onPress={() => setBackupDestination('dropbox')}
            />
          </Row>
          <Text style={styles.sub}>Google Drive/Dropbox use the iOS Share Sheet destination picker.</Text>
          <Label>Backup interval (days)</Label>
          <Input value={backupIntervalDays} onChangeText={setBackupIntervalDays} keyboardType="number-pad" />
          <Row>
            <Text style={styles.label}>Include PDF</Text>
            <Switch
              value={backupSettings.includePdf}
              onValueChange={(includePdf) => updateBackupSettings({ ...backupSettings, includePdf })}
            />
          </Row>
          <Row>
            <Text style={styles.label}>Include Excel</Text>
            <Switch
              value={backupSettings.includeExcel}
              onValueChange={(includeExcel) => updateBackupSettings({ ...backupSettings, includeExcel })}
            />
          </Row>
          <Text style={styles.sub}>
            Last backup: {backupSettings.lastBackupAt ? formatDateTime(backupSettings.lastBackupAt) : 'Never'}
          </Text>
          <View style={styles.buttonGroup}>
            <Button title="Apply Backup Settings" variant="secondary" onPress={applyBackupSettings} />
            <Button title="Run Backup Now" onPress={onRunBackupNow} />
          </View>
        </Card>

        <Card title="Account">
          <Row>
            <Ionicons name="person-circle-outline" size={16} color="#334155" />
            <Text style={styles.sectionSub}>Access and linked caregivers</Text>
          </Row>

          <Text style={styles.sectionSub}>Linked accounts</Text>
          <View style={styles.accountList}>
            {dummyAccounts.map((account) => (
              <View key={account.phone} style={styles.accountItem}>
                <View>
                  <Text style={styles.accountName}>{account.name}</Text>
                  <Text style={styles.accountMeta}>{account.phone}</Text>
                </View>
                <Text style={styles.accountMeta}>{account.lastUsed}</Text>
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
  buttonGroup: { marginTop: 8, gap: 8 },
  accountList: { gap: 8, marginBottom: 8 },
  accountItem: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  accountName: { color: '#111827', fontSize: 13, fontWeight: '600' },
  accountMeta: { color: '#6b7280', fontSize: 12 },
  sectionSpacer: { height: 16 },
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
