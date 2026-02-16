import React, { useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Switch, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, Card, Input, Label, Row, SelectPill } from '../components/ui';
import { useAppContext } from '../context/AppContext';
import { cancelReminder, requestNotificationPermission } from '../services/notifications';
import { recalculateReminder } from '../services/reminderCoordinator';
import { exportExcel, exportPdf } from '../services/exports';
import { DateRange } from '../types/models';
import { presetDateRange } from '../utils/dateRange';
import { formatDateTime } from '../utils/time';
import { signOut } from '../supabase/auth';
import { seedDemoData, clearDemoData } from '../services/seed';
import { SyncBanner } from '../components/SyncBanner';

export const SettingsScreen = () => {
  const {
    babyId,
    amountUnit,
    weightUnit,
    reminderSettings,
    updateAmountUnit,
    updateWeightUnit,
    updateReminderSettings,
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
      Alert.alert('Demo data added', 'Sample feeds and measurements were generated.');
    } catch (error: any) {
      Alert.alert('Seed failed', error?.message ?? 'Unknown error');
    }
  };

  const onClearData = async () => {
    try {
      await clearDemoData(babyId);
      await syncNow();
      bumpDataVersion();
      Alert.alert('Data cleared', 'Feed, measurement, temperature, and diaper records were removed.');
    } catch (error: any) {
      Alert.alert('Clear failed', error?.message ?? 'Unknown error');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <SyncBanner
          syncState={syncState}
          syncError={syncError}
          lastSyncAt={lastSyncAt}
          enabled={supabaseEnabled}
        />
        <Card title="Units">
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
        </Card>

        <Card title="Reminders">
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

        <Card title="Export">
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
          <Text style={styles.sub}>{supabaseEnabled ? 'Supabase configured' : 'Supabase not configured'}</Text>
          <Text style={styles.sub}>{session ? `Signed in as ${session.user.email}` : 'Not signed in'}</Text>
          <Button title="Sync Now" onPress={syncNow} />
          {session ? <Button title="Sign Out" variant="danger" onPress={onSignOut} /> : null}
        </Card>

        <Card title="QA Tools">
          <Text style={styles.sub}>Use sample data to validate reminders, charts, care logs, and exports quickly.</Text>
          <Button title="Seed Demo Data" onPress={onSeedData} />
          <Button title="Clear Local Tracking Data" variant="danger" onPress={onClearData} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 16, gap: 10 },
  label: { color: '#374151', fontWeight: '500' },
  sub: { color: '#4b5563', fontSize: 13, marginBottom: 8 },
});
