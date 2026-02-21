import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../app/navigation';
import { Button, Card, EmptyState, Input, Row, SelectPill } from '../components/ui';
import { ToastBanner, ToastBannerKind } from '../components/ToastBanner';
import { useAppContext } from '../context/AppContext';
import { getPinnedLogs, setPinnedLogs } from '../db/settingsRepo';
import { listFeeds, softDeleteFeed } from '../db/feedRepo';
import { listMeasurements, softDeleteMeasurement } from '../db/measurementRepo';
import { listTemperatureLogs, softDeleteTemperatureLog } from '../db/temperatureRepo';
import { listDiaperLogs, softDeleteDiaperLog } from '../db/diaperRepo';
import { getMedicationSpacingAlert, listMedicationLogs, softDeleteMedicationLog } from '../db/medicationRepo';
import { listMilestones, softDeleteMilestone } from '../db/milestoneRepo';
import { recalculateReminder } from '../services/reminderCoordinator';
import { AppTheme } from '../theme/designSystem';
import { useAppTheme } from '../theme/useAppTheme';
import { formatDateTime, startOfDay } from '../utils/time';
import { cToDisplay, formatAmount, formatTemp, formatWeight } from '../utils/units';

type LogFilter = 'all' | 'pinned' | 'feed' | 'measurement' | 'temperature' | 'diaper' | 'medication' | 'milestone';
type EntryKind = 'feed' | 'measurement' | 'temperature' | 'diaper' | 'medication' | 'milestone';

type LogEntry = {
  id: string;
  kind: EntryKind;
  timestamp: string;
  title: string;
  subtitle: string;
  notes?: string | null;
};

const filters: LogFilter[] = ['all', 'pinned', 'feed', 'measurement', 'temperature', 'diaper', 'medication', 'milestone'];

type GlanceStats = {
  feedsToday: number;
  diapersToday: number;
  latestTemp: string;
  entriesToday: number;
};

type AlertItem = {
  level: 'warning' | 'critical';
  message: string;
};

type RangePreset = 'today' | '7d' | '30d' | 'all';

type ToastState = {
  kind: ToastBannerKind;
  message: string;
} | null;

const getKindMeta = (kind: EntryKind, theme: AppTheme) => {
  if (kind === 'feed') {
    return {
      label: 'Feed',
      icon: 'restaurant-outline' as const,
      iconColor: '#BE123C',
      bg: theme.mode === 'dark' ? 'rgba(190, 18, 60, 0.24)' : '#FFF1F2',
      border: theme.mode === 'dark' ? 'rgba(251, 113, 133, 0.45)' : '#FECDD3',
    };
  }

  if (kind === 'measurement') {
    return {
      label: 'Growth',
      icon: 'barbell-outline' as const,
      iconColor: '#0F766E',
      bg: theme.mode === 'dark' ? 'rgba(15, 118, 110, 0.26)' : '#ECFDF5',
      border: theme.mode === 'dark' ? 'rgba(52, 211, 153, 0.45)' : '#BBF7D0',
    };
  }

  if (kind === 'temperature') {
    return {
      label: 'Temp',
      icon: 'thermometer-outline' as const,
      iconColor: '#B45309',
      bg: theme.mode === 'dark' ? 'rgba(180, 83, 9, 0.22)' : '#FFFBEB',
      border: theme.mode === 'dark' ? 'rgba(251, 191, 36, 0.45)' : '#FDE68A',
    };
  }

  if (kind === 'diaper') {
    return {
      label: 'Diaper',
      icon: 'water-outline' as const,
      iconColor: '#1D4ED8',
      bg: theme.mode === 'dark' ? 'rgba(29, 78, 216, 0.24)' : '#EFF6FF',
      border: theme.mode === 'dark' ? 'rgba(56, 189, 248, 0.45)' : '#BFDBFE',
    };
  }

  if (kind === 'medication') {
    return {
      label: 'Medication',
      icon: 'medkit-outline' as const,
      iconColor: '#7C2D12',
      bg: theme.mode === 'dark' ? 'rgba(124, 45, 18, 0.24)' : '#FFF7ED',
      border: theme.mode === 'dark' ? 'rgba(249, 115, 22, 0.45)' : '#FDBA74',
    };
  }

  return {
    label: 'Milestone',
    icon: 'trophy-outline' as const,
    iconColor: '#6D28D9',
    bg: theme.mode === 'dark' ? 'rgba(109, 40, 217, 0.24)' : '#F5F3FF',
    border: theme.mode === 'dark' ? 'rgba(167, 139, 250, 0.45)' : '#DDD6FE',
  };
};

const rangeFilterPills: Array<{ id: RangePreset; label: string }> = [
  { id: 'today', label: 'today' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'all' },
];

export const LogsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { babyId, amountUnit, weightUnit, tempUnit, reminderSettings, smartAlertSettings, syncNow, bumpDataVersion, dataVersion } =
    useAppContext();

  const [filter, setFilter] = useState<LogFilter>('all');
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [rangePreset, setRangePreset] = useState<RangePreset>('7d');
  const [pinned, setPinned] = useState<string[]>([]);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [glance, setGlance] = useState<GlanceStats>({
    feedsToday: 0,
    diapersToday: 0,
    latestTemp: '—',
    entriesToday: 0,
  });
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const logKey = (entry: Pick<LogEntry, 'kind' | 'id'>) => `${entry.kind}:${entry.id}`;

  const showToast = (message: string, kind: ToastBannerKind = 'info') => {
    setToast({ kind, message });
  };

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  const loadPinned = useCallback(async () => {
    const keys = await getPinnedLogs();
    setPinned(keys);
  }, []);

  const load = useCallback(async () => {
    const [feeds, measurements, temps, diapers, medications, milestones] = await Promise.all([
      listFeeds(babyId),
      listMeasurements(babyId),
      listTemperatureLogs(babyId),
      listDiaperLogs(babyId),
      listMedicationLogs(babyId),
      listMilestones(babyId),
    ]);

    const mapped: LogEntry[] = [
      ...feeds.map((item) => ({
        id: item.id,
        kind: 'feed' as const,
        timestamp: item.timestamp,
        title: `Feed • ${item.type}`,
        subtitle: `${formatAmount(item.amount_ml, item.type === 'solids' ? 'oz' : amountUnit)} • ${item.duration_minutes ?? 0} min • ${item.side}`,
        notes: item.notes,
      })),
      ...measurements.map((item) => ({
        id: item.id,
        kind: 'measurement' as const,
        timestamp: item.timestamp,
        title: `Growth • ${formatWeight(item.weight_kg, weightUnit)}`,
        subtitle: `Length ${item.length_cm ?? '—'} cm • Head ${item.head_circumference_cm ?? '—'} cm`,
        notes: item.notes,
      })),
      ...temps.map((item) => ({
        id: item.id,
        kind: 'temperature' as const,
        timestamp: item.timestamp,
        title: `Temp • ${formatTemp(Number(item.temperature_c), tempUnit)}`,
        subtitle: 'Temperature check',
        notes: item.notes,
      })),
      ...diapers.map((item) => ({
        id: item.id,
        kind: 'diaper' as const,
        timestamp: item.timestamp,
        title: 'Diaper',
        subtitle: `${item.had_pee ? 'pee' : ''}${item.had_pee && item.had_poop ? ' + ' : ''}${item.had_poop ? `poop (${item.poop_size ?? 'small'})` : ''}`,
        notes: item.notes,
      })),
      ...medications.map((item) => ({
        id: item.id,
        kind: 'medication' as const,
        timestamp: item.timestamp,
        title: `Medication • ${item.medication_name}`,
        subtitle: `${item.dose_value} ${item.dose_unit}${item.min_interval_hours ? ` • min ${item.min_interval_hours}h` : ''}`,
        notes: item.notes,
      })),
      ...milestones.map((item) => ({
        id: item.id,
        kind: 'milestone' as const,
        timestamp: item.timestamp,
        title: `Milestone • ${item.title}`,
        subtitle: item.photo_uri ? 'Photo attached' : 'Milestone note',
        notes: item.notes,
      })),
    ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    setEntries(mapped);
    setPendingDeleteKey(null);

    const dayStart = startOfDay(new Date()).getTime();
    setGlance({
      feedsToday: feeds.filter((x) => new Date(x.timestamp).getTime() >= dayStart).length,
      diapersToday: diapers.filter((x) => new Date(x.timestamp).getTime() >= dayStart).length,
      latestTemp: temps.length ? cToDisplay(Number(temps[0].temperature_c), tempUnit).toFixed(1) : '—',
      entriesToday: mapped.filter((x) => new Date(x.timestamp).getTime() >= dayStart).length,
    });

    const nextAlerts: AlertItem[] = [];
    const lastFeed = feeds[0];
    const latestTemp = temps[0];
    const lastDiaper = diapers[0];

    if (lastFeed && smartAlertSettings.enabled) {
      const hoursSinceFeed = (Date.now() - new Date(lastFeed.timestamp).getTime()) / 36e5;
      if (hoursSinceFeed >= smartAlertSettings.feedGapHours) {
        nextAlerts.push({
          level: 'warning',
          message: `No recent feed for ${hoursSinceFeed.toFixed(1)}h (threshold ${smartAlertSettings.feedGapHours}h).`,
        });
      }
    }

    if (latestTemp && smartAlertSettings.enabled && Number(latestTemp.temperature_c) >= smartAlertSettings.feverThresholdC) {
      nextAlerts.push({
        level: 'critical',
        message: `Latest logged temperature is ${formatTemp(Number(latestTemp.temperature_c), tempUnit)}.`,
      });
    }

    if (lastDiaper && smartAlertSettings.enabled) {
      const hoursSinceDiaper = (Date.now() - new Date(lastDiaper.timestamp).getTime()) / 36e5;
      if (hoursSinceDiaper >= smartAlertSettings.diaperGapHours) {
        nextAlerts.push({
          level: 'warning',
          message: `No diaper log for ${hoursSinceDiaper.toFixed(1)}h (threshold ${smartAlertSettings.diaperGapHours}h).`,
        });
      }
    }

    if (smartAlertSettings.enabled) {
      const feed24 = feeds.filter((x) => Date.now() - new Date(x.timestamp).getTime() <= 24 * 60 * 60 * 1000).length;
      if (feed24 < smartAlertSettings.lowFeedsPerDay) {
        nextAlerts.push({
          level: 'warning',
          message: `Only ${feed24} feed(s) in last 24h (target ${smartAlertSettings.lowFeedsPerDay}).`,
        });
      }

      const spacingAlert = await getMedicationSpacingAlert(babyId);
      if (spacingAlert) {
        nextAlerts.push({
          level: 'critical',
          message: `${spacingAlert.medication} given after ${spacingAlert.actualHours.toFixed(1)}h (minimum ${spacingAlert.minHours}h).`,
        });
      }
    }

    setAlerts(nextAlerts);
    await loadPinned();
  }, [
    babyId,
    amountUnit,
    weightUnit,
    tempUnit,
    smartAlertSettings.enabled,
    smartAlertSettings.feedGapHours,
    smartAlertSettings.diaperGapHours,
    smartAlertSettings.feverThresholdC,
    smartAlertSettings.lowFeedsPerDay,
    loadPinned,
  ]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [dataVersion, load]);

  const visible = useMemo<LogEntry[]>(() => {
    const now = new Date();
    const dayStart = startOfDay(now).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    const byRange = entries.filter((x) => {
      const ts = new Date(x.timestamp).getTime();
      if (rangePreset === 'today') return ts >= dayStart;
      if (rangePreset === '7d') return ts >= sevenDaysAgo;
      if (rangePreset === '30d') return ts >= thirtyDaysAgo;
      return true;
    });

    let typed: LogEntry[] = byRange;
    if (filter === 'pinned') {
      typed = byRange.filter((x) => pinned.includes(logKey(x)));
    } else if (filter !== 'all') {
      typed = byRange.filter((x) => x.kind === filter);
    }

    const query = search.trim().toLowerCase();
    if (!query) return typed;

    return typed.filter((x) => {
      const text = `${x.kind} ${x.title} ${x.subtitle} ${x.notes ?? ''}`.toLowerCase();
      return text.includes(query);
    });
  }, [entries, filter, search, rangePreset, pinned]);

  const filteredCounts = useMemo(() => {
    const counts = {
      feed: 0,
      measurement: 0,
      temperature: 0,
      diaper: 0,
      medication: 0,
      milestone: 0,
    };
    for (const item of visible) counts[item.kind] += 1;
    return counts;
  }, [visible]);

  const deleteEntry = async (entry: LogEntry) => {
    try {
      if (entry.kind === 'feed') {
        await softDeleteFeed(entry.id);
        try {
          await recalculateReminder(babyId, reminderSettings);
        } catch {
          // keep deletion successful even if reminder reschedule fails
        }
      }
      if (entry.kind === 'measurement') await softDeleteMeasurement(entry.id);
      if (entry.kind === 'temperature') await softDeleteTemperatureLog(entry.id);
      if (entry.kind === 'diaper') await softDeleteDiaperLog(entry.id);
      if (entry.kind === 'medication') await softDeleteMedicationLog(entry.id);
      if (entry.kind === 'milestone') await softDeleteMilestone(entry.id);
    } catch (error: any) {
      showToast(error?.message ?? 'Delete failed.', 'error');
      return;
    }

    bumpDataVersion();
    await load();
    void syncNow().catch(() => undefined);
    showToast('Entry deleted.', 'success');
  };

  const requestDelete = (entry: LogEntry) => {
    const key = logKey(entry);
    if (pendingDeleteKey !== key) {
      setPendingDeleteKey(key);
      showToast('Tap delete again to confirm.', 'info');
      return;
    }

    setPendingDeleteKey(null);
    void deleteEntry(entry);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await syncNow();
      await load();
      showToast('Logs refreshed.', 'success');
    } catch (error: any) {
      showToast(error?.message ?? 'Refresh failed.', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const togglePin = async (entry: LogEntry) => {
    const key = logKey(entry);
    const exists = pinned.includes(key);
    const next = exists ? pinned.filter((x) => x !== key) : [...pinned, key];
    setPinned(next);
    await setPinnedLogs(next);
  };

  const renderRow = ({ item, index }: { item: LogEntry; index: number }) => {
    const itemDay = item.timestamp.slice(0, 10);
    const prevDay = index > 0 ? visible[index - 1].timestamp.slice(0, 10) : '';
    const showDayHeader = itemDay !== prevDay;
    const meta = getKindMeta(item.kind, theme);
    const isDeletePending = pendingDeleteKey === logKey(item);

    return (
      <>
        {showDayHeader ? (
          <Text style={[styles.dayHeader, { color: theme.colors.textSecondary }]}> 
            {new Date(`${itemDay}T00:00:00`).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        ) : null}

        <Pressable
          style={[styles.row, { backgroundColor: meta.bg, borderColor: meta.border }]}
          onPress={() => navigation.navigate('AddEntry', { type: item.kind, entryId: item.id })}
          onLongPress={() => requestDelete(item)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${meta.label} entry`}
        >
          <View style={styles.rowHead}>
            <View style={styles.kindWrap}>
              <View style={[styles.kindIconBubble, { borderColor: meta.border, backgroundColor: theme.colors.surface }]}> 
                <Ionicons name={meta.icon} size={16} color={meta.iconColor} />
              </View>
              <Text style={[styles.kind, { color: meta.iconColor }]}>{meta.label}</Text>
            </View>

            <View style={styles.rowActions}>
              <Pressable
                onPress={() => togglePin(item)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={pinned.includes(logKey(item)) ? 'Unpin entry' : 'Pin entry'}
              >
                <Ionicons
                  name={pinned.includes(logKey(item)) ? 'star' : 'star-outline'}
                  size={18}
                  color={pinned.includes(logKey(item)) ? '#F59E0B' : theme.colors.textMuted}
                />
              </Pressable>
              <Pressable
                onPress={() => requestDelete(item)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Delete entry"
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={isDeletePending ? theme.colors.error : theme.colors.textMuted}
                />
              </Pressable>
            </View>
          </View>

          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{item.title}</Text>
          <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>{formatDateTime(item.timestamp)}</Text>
          <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>{item.subtitle || '—'}</Text>
          {item.notes ? <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>{item.notes}</Text> : null}
        </Pressable>
      </>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}> 
      <FlatList
        data={visible}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            {toast ? <ToastBanner kind={toast.kind} message={toast.message} onDismiss={() => setToast(null)} /> : null}

            <Card title="Quick Add">
              <Row>
                <SelectPill label="+ Feed" selected={false} onPress={() => navigation.navigate('AddEntry', { type: 'feed' })} />
                <SelectPill label="+ Growth" selected={false} onPress={() => navigation.navigate('AddEntry', { type: 'measurement' })} />
                <SelectPill label="+ Temp" selected={false} onPress={() => navigation.navigate('AddEntry', { type: 'temperature' })} />
                <SelectPill label="+ Diaper" selected={false} onPress={() => navigation.navigate('AddEntry', { type: 'diaper' })} />
                <SelectPill label="+ Med" selected={false} onPress={() => navigation.navigate('AddEntry', { type: 'medication' })} />
                <SelectPill label="+ Milestone" selected={false} onPress={() => navigation.navigate('AddEntry', { type: 'milestone' })} />
              </Row>
              <Button title="Refresh Logs" variant="secondary" onPress={load} />
            </Card>

            <Card title="Today At A Glance">
              <Row>
                <View style={[styles.statBox, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{glance.entriesToday}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>entries</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{glance.feedsToday}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>feeds</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{glance.diapersToday}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>diapers</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{glance.latestTemp}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>latest {tempUnit.toUpperCase()}</Text>
                </View>
              </Row>
            </Card>

            <Card title="Alerts">
              {alerts.length ? (
                alerts.map((item, idx) => (
                  <Text
                    key={`${item.level}-${idx}`}
                    style={[
                      styles.alertItem,
                      {
                        backgroundColor: item.level === 'critical' ? theme.colors.primarySoft : theme.colors.surfaceAlt,
                        color: item.level === 'critical' ? theme.colors.error : theme.colors.warning,
                      },
                    ]}
                  >
                    {item.level === 'critical' ? 'Critical: ' : 'Warning: '}
                    {item.message}
                  </Text>
                ))
              ) : (
                <Text style={[styles.alertOk, { color: theme.colors.success, backgroundColor: theme.colors.surfaceAlt }]}>No active alerts right now.</Text>
              )}
            </Card>

            <Card title="Filter">
              <Text style={[styles.filterTitle, { color: theme.colors.textSecondary }]}>Range</Text>
              <Row>
                {rangeFilterPills.map((item) => (
                  <SelectPill key={item.id} label={item.label} selected={rangePreset === item.id} onPress={() => setRangePreset(item.id)} />
                ))}
              </Row>

              <Text style={[styles.filterTitle, { color: theme.colors.textSecondary }]}>Type</Text>
              <Row>
                {filters.map((option) => (
                  <SelectPill key={option} label={option} selected={filter === option} onPress={() => setFilter(option)} />
                ))}
              </Row>

              <Input value={search} onChangeText={setSearch} placeholder="Search notes, type, details..." style={styles.searchInput} />
              <Text style={[styles.hint, { color: theme.colors.textMuted }]}>Tap entry to edit. Long-press or trash icon to delete.</Text>
            </Card>

            <Card title="Filtered Snapshot">
              <Row>
                <View style={[styles.statBox, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{visible.length}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>entries</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{filteredCounts.feed}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>feeds</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{filteredCounts.measurement}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>growth</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{filteredCounts.temperature}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>temp</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{filteredCounts.diaper}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>diapers</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{filteredCounts.medication}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>meds</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}> 
                  <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{filteredCounts.milestone}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>milestones</Text>
                </View>
              </Row>
            </Card>
          </View>
        }
        renderItem={renderRow}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<EmptyState title="No entries yet" subtitle="Add your first log entry to begin tracking." />}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    safe: { flex: 1 },
    headerWrap: { paddingTop: theme.spacing[4], gap: theme.spacing[2] },
    hint: { ...theme.typography.caption, marginTop: theme.spacing[1] },
    filterTitle: { ...theme.typography.caption, marginTop: theme.spacing[2], marginBottom: theme.spacing[1] },
    dayHeader: {
      ...theme.typography.caption,
      fontWeight: '700',
      marginTop: theme.spacing[2],
      marginBottom: theme.spacing[1],
      marginLeft: theme.spacing[1],
    },
    statBox: {
      borderWidth: 1,
      borderRadius: theme.radius.sm,
      paddingVertical: theme.spacing[2],
      paddingHorizontal: theme.spacing[3],
      minWidth: 74,
    },
    statValue: { ...theme.typography.h6, fontWeight: '800' },
    statLabel: { ...theme.typography.caption },
    alertItem: {
      ...theme.typography.bodySm,
      marginBottom: theme.spacing[2],
      paddingHorizontal: theme.spacing[3],
      paddingVertical: theme.spacing[2],
      borderRadius: theme.radius.sm,
      fontWeight: '600',
    },
    alertOk: {
      ...theme.typography.bodySm,
      paddingHorizontal: theme.spacing[3],
      paddingVertical: theme.spacing[2],
      borderRadius: theme.radius.sm,
      fontWeight: '600',
    },
    searchInput: {
      marginTop: theme.spacing[2],
    },
    row: {
      borderRadius: theme.radius.md,
      borderWidth: 1,
      padding: theme.spacing[3],
    },
    rowHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing[1],
    },
    kindWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
    },
    kindIconBubble: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kind: { ...theme.typography.caption, fontWeight: '800' },
    rowActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
    },
    title: { ...theme.typography.bodyLg, fontWeight: '800', marginBottom: theme.spacing[1] },
    sub: { ...theme.typography.bodySm, marginBottom: 2 },
    separator: { height: theme.spacing[2] },
    listContent: {
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[4],
    },
  });
