import React, { useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Input, Label, Row, SelectPill } from '../components/ui';
import { useAppContext } from '../context/AppContext';
import { cancelReminder, requestNotificationPermission } from '../services/notifications';
import { recalculateReminder } from '../services/reminderCoordinator';
import { exportExcel, exportPdf } from '../services/exports';
import { BackupDestination, DateRange } from '../types/models';
import { presetDateRange } from '../utils/dateRange';
import { formatDateTime } from '../utils/time';
import { signOut } from '../supabase/auth';
import { seedDemoData, clearDemoData } from '../services/seed';
import { SyncBanner } from '../components/SyncBanner';
import { runAutoBackupIfDue, runBackupNow } from '../services/backups';

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
    bumpDataVersion,
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

  useFocusEffect(
    React.useCallback(() => {
      const run = async () => {
        const updatedAt = await runAutoBackupIfDue(backupSettings);
        if (updatedAt) {
          await updateBackupSettings({ ...backupSettings, lastBackupAt: updatedAt });
        }
      };
      run();
    }, [backupSettings]),
  );

  const applyReminderSettings = async (enabled: boolean) => {
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
        Alert.alert('Permission required', 'Notification permission is required for reminders.');
        return;
      }
      await updateReminderSettings(nextSettings);
      await recalculateReminder(babyId, nextSettings);
      return;
    }

    await cancelReminder();
    await updateReminderSettings(nextSettings);
  };

  const toggleQuietHours = async (allow: boolean) => {
    const next = { ...reminderSettings, allowDuringQuietHours: allow };
    await updateReminderSettings(next);
    if (next.enabled) {
      await recalculateReminder(babyId, next);
    }
  };

  const runExport = async (kind: 'pdf' | 'excel') => {
    try {
      if (kind === 'pdf') {
        await exportPdf(dateRange);
      } else {
        await exportExcel(dateRange);
      }
    } catch (error: any) {
      Alert.alert('Export failed', error?.message ?? 'Unknown export error');
    }
  };

  const onSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      Alert.alert('Sign out failed', error?.message ?? 'Unknown error');
    }
  };

  const onSeedData = async () => {
    try {
      await clearDemoData(babyId);
      await seedDemoData(babyId);
      await syncNow();
      bumpDataVersion();
      Alert.alert('Demo data added', 'Generated ~6 months of sample tracking data for charts.');
    } catch (error: any) {
      Alert.alert('Seed failed', error?.message ?? 'Unknown error');
    }
  };

  const onClearData = async () => {
    try {
      await clearDemoData(babyId);
      await syncNow();
      bumpDataVersion();
      Alert.alert('Data cleared', 'Feed, growth, temperature, diaper, medication, and milestone records were removed.');
    } catch (error: any) {
      Alert.alert('Clear failed', error?.message ?? 'Unknown error');
    }
  };

  const applySmartAlerts = async () => {
    const next = {
      ...smartAlertSettings,
      feedGapHours: Number(feedGapHours) || 4.5,
      diaperGapHours: Number(diaperGapHours) || 8,
      feverThresholdC: Number(feverThresholdC) || 38,
      lowFeedsPerDay: Number(lowFeedsPerDay) || 6,
    };
    await updateSmartAlertSettings(next);
    bumpDataVersion();
  };

  const setBackupDestination = async (destination: BackupDestination) => {
    await updateBackupSettings({ ...backupSettings, destination });
  };

  const toggleAutoBackup = async (enabled: boolean) => {
    const next = {
      ...backupSettings,
      enabled,
      intervalDays: Number(backupIntervalDays) || 1,
    };
    await updateBackupSettings(next);
  };

  const onRunBackupNow = async () => {
    try {
      const lastBackupAt = await runBackupNow({ ...backupSettings, intervalDays: Number(backupIntervalDays) || 1 });
      await updateBackupSettings({ ...backupSettings, intervalDays: Number(backupIntervalDays) || 1, lastBackupAt });
    } catch (error: any) {
      Alert.alert('Backup failed', error?.message ?? 'Unknown backup error');
    }
  };

  const applyBackupSettings = async () => {
    await updateBackupSettings({
      ...backupSettings,
      intervalDays: Number(backupIntervalDays) || 1,
    });
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
              <Ionicons name="notifications-outline" size={14} color="#1d4ed8" />
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

          <Button title="Apply Reminder Changes" onPress={() => applyReminderSettings(reminderSettings.enabled)} />
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
              onValueChange={(enabled) => updateSmartAlertSettings({ ...smartAlertSettings, enabled })}
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

          <Button title="Apply Alert Thresholds" onPress={applySmartAlerts} />
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

          <Text style={styles.sub}>Range: {formatDateTime(dateRange.start.toISOString())} - {formatDateTime(dateRange.end.toISOString())}</Text>

          <Button title="Export PDF" onPress={() => runExport('pdf')} />
          <Button title="Export Excel (.xlsx)" onPress={() => runExport('excel')} variant="secondary" />
        </Card>

        <Card title="Cloud Sync">
          <Row>
            <Ionicons name="cloud-outline" size={16} color="#334155" />
            <Text style={styles.sectionSub}>Account and synchronization</Text>
          </Row>
          <Text style={styles.sub}>{supabaseEnabled ? 'Supabase configured' : 'Supabase not configured'}</Text>
          <Text style={styles.sub}>{session ? `Signed in as ${session.user.email}` : 'Not signed in'}</Text>
          <Button title="Sync Now" onPress={syncNow} />
          {session ? <Button title="Sign Out" variant="danger" onPress={onSignOut} /> : null}
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
          <Button title="Apply Backup Settings" variant="secondary" onPress={applyBackupSettings} />
          <Button title="Run Backup Now" onPress={onRunBackupNow} />
        </Card>

        <Card title="QA Tools">
          <Row>
            <Ionicons name="construct-outline" size={16} color="#334155" />
            <Text style={styles.sectionSub}>Testing helpers</Text>
          </Row>
          <Text style={styles.sub}>Use sample data to validate reminders, charts, medications, milestones, and exports quickly.</Text>
          <Button title="Seed Demo Data" onPress={onSeedData} />
          <Button title="Clear Local Tracking Data" variant="danger" onPress={onClearData} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef3fb' },
  content: { padding: 16, gap: 10 },
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
});
