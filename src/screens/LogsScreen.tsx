import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../app/navigation';
import { Button, Card, Input, Row, SelectPill } from '../components/ui';
import { useAppContext } from '../context/AppContext';
import { getPinnedLogs, setPinnedLogs } from '../db/settingsRepo';
import { listFeeds, softDeleteFeed } from '../db/feedRepo';
import { listMeasurements, softDeleteMeasurement } from '../db/measurementRepo';
import { listTemperatureLogs, softDeleteTemperatureLog } from '../db/temperatureRepo';
import { listDiaperLogs, softDeleteDiaperLog } from '../db/diaperRepo';
import { recalculateReminder } from '../services/reminderCoordinator';
import { exportExcel, exportPdf, ExportKind } from '../services/exports';
import { DateRange } from '../types/models';
import { formatDateTime, startOfDay } from '../utils/time';
import { cToDisplay, formatAmount, formatTemp, formatWeight } from '../utils/units';

type LogFilter = 'all' | 'pinned' | 'feed' | 'measurement' | 'temperature' | 'diaper';
type EntryKind = 'feed' | 'measurement' | 'temperature' | 'diaper';

type LogEntry = {
  id: string;
  kind: EntryKind;
  timestamp: string;
  title: string;
  subtitle: string;
  notes?: string | null;
};

const filters: LogFilter[] = ['all', 'pinned', 'feed', 'measurement', 'temperature', 'diaper'];

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

export const LogsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { babyId, amountUnit, weightUnit, tempUnit, reminderSettings, syncNow, bumpDataVersion, dataVersion } =
    useAppContext();
  const [filter, setFilter] = useState<LogFilter>('all');
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [rangePreset, setRangePreset] = useState<RangePreset>('7d');
  const [pinned, setPinned] = useState<string[]>([]);
  const [glance, setGlance] = useState<GlanceStats>({
    feedsToday: 0,
    diapersToday: 0,
    latestTemp: '—',
    entriesToday: 0,
  });
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [dailyCounts, setDailyCounts] = useState<Array<{ day: string; count: number }>>([]);

  const logKey = (entry: Pick<LogEntry, 'kind' | 'id'>) => `${entry.kind}:${entry.id}`;

  const loadPinned = useCallback(async () => {
    const keys = await getPinnedLogs();
    setPinned(keys);
  }, []);

  const load = useCallback(async () => {
    const [feeds, measurements, temps, diapers] = await Promise.all([
      listFeeds(babyId),
      listMeasurements(babyId),
      listTemperatureLogs(babyId),
      listDiaperLogs(babyId),
    ]);

    const mapped: LogEntry[] = [
      ...feeds.map((item) => ({
        id: item.id,
        kind: 'feed' as const,
        timestamp: item.timestamp,
        title: `Feed • ${item.type}`,
        subtitle: `${formatAmount(item.amount_ml, amountUnit)} • ${item.duration_minutes ?? 0} min • ${item.side}`,
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
    ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    setEntries(mapped);

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

    if (lastFeed && reminderSettings.enabled) {
      const hoursSinceFeed = (Date.now() - new Date(lastFeed.timestamp).getTime()) / 36e5;
      if (hoursSinceFeed >= reminderSettings.intervalHours * 1.5) {
        nextAlerts.push({
          level: 'warning',
          message: `No recent feed for ${hoursSinceFeed.toFixed(1)}h (interval set to ${reminderSettings.intervalHours}h).`,
        });
      }
    }

    if (latestTemp && Number(latestTemp.temperature_c) >= 38) {
      nextAlerts.push({
        level: 'critical',
        message: `Latest logged temperature is ${formatTemp(Number(latestTemp.temperature_c), tempUnit)}.`,
      });
    }

    if (lastDiaper) {
      const hoursSinceDiaper = (Date.now() - new Date(lastDiaper.timestamp).getTime()) / 36e5;
      if (hoursSinceDiaper >= 8) {
        nextAlerts.push({
          level: 'warning',
          message: `No diaper log for ${hoursSinceDiaper.toFixed(1)}h.`,
        });
      }
    }

    setAlerts(nextAlerts);

    const countsMap = new Map<string, number>();
    for (let i = 41; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      countsMap.set(d.toISOString().slice(0, 10), 0);
    }
    mapped.forEach((item) => {
      const day = item.timestamp.slice(0, 10);
      if (countsMap.has(day)) {
        countsMap.set(day, (countsMap.get(day) ?? 0) + 1);
      }
    });
    setDailyCounts(Array.from(countsMap.entries()).map(([day, count]) => ({ day, count })));
    await loadPinned();
  }, [babyId, amountUnit, weightUnit, tempUnit, reminderSettings.enabled, reminderSettings.intervalHours, loadPinned]);

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
    } else if (filter === 'feed') {
      typed = byRange.filter((x) => x.kind === 'feed');
    } else if (filter === 'measurement') {
      typed = byRange.filter((x) => x.kind === 'measurement');
    } else if (filter === 'temperature') {
      typed = byRange.filter((x) => x.kind === 'temperature');
    } else if (filter === 'diaper') {
      typed = byRange.filter((x) => x.kind === 'diaper');
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
    };
    for (const item of visible) counts[item.kind] += 1;
    return counts;
  }, [visible]);

  const onDelete = (entry: LogEntry) => {
    Alert.alert('Delete entry', 'Remove this log entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (entry.kind === 'feed') {
            await softDeleteFeed(entry.id);
            await recalculateReminder(babyId, reminderSettings);
          }
          if (entry.kind === 'measurement') await softDeleteMeasurement(entry.id);
          if (entry.kind === 'temperature') await softDeleteTemperatureLog(entry.id);
          if (entry.kind === 'diaper') await softDeleteDiaperLog(entry.id);

          await syncNow();
          bumpDataVersion();
          load();
        },
      },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await syncNow();
      await load();
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

  const currentDateRange = useMemo<DateRange | null>(() => {
    if (!visible.length) return null;
    const end = new Date();
    let start = startOfDay(end);
    if (rangePreset === '7d') start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (rangePreset === '30d') start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (rangePreset === 'all') {
      const oldest = visible[visible.length - 1];
      start = new Date(oldest.timestamp);
    }
    return { start, end, label: 'Logs Export' };
  }, [visible, rangePreset]);

  const exportKinds = useMemo<ExportKind[] | undefined>(() => {
    if (filter === 'feed') return ['feed'];
    if (filter === 'measurement') return ['measurement'];
    if (filter === 'temperature') return ['temperature'];
    if (filter === 'diaper') return ['diaper'];
    return undefined;
  }, [filter]);

  const onExportFiltered = async (kind: 'pdf' | 'excel') => {
    if (!currentDateRange) {
      Alert.alert('No data', 'Nothing to export for this filter/range.');
      return;
    }
    try {
      if (kind === 'pdf') {
        await exportPdf(currentDateRange, { kinds: exportKinds });
      } else {
        await exportExcel(currentDateRange, { kinds: exportKinds });
      }
    } catch (error: any) {
      Alert.alert('Export failed', error?.message ?? 'Unknown error');
    }
  };

  const maxDailyCount = useMemo(() => Math.max(...dailyCounts.map((x) => x.count), 1), [dailyCounts]);
  const heatColor = (count: number) => {
    if (count <= 0) return '#e5e7eb';
    const intensity = count / maxDailyCount;
    if (intensity < 0.34) return '#bfdbfe';
    if (intensity < 0.67) return '#60a5fa';
    return '#2563eb';
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={visible}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <Card title="Quick Add">
              <Row>
                <SelectPill label="+ Feed" selected={false} onPress={() => navigation.navigate('AddEntry', { type: 'feed' })} />
                <SelectPill
                  label="+ Growth"
                  selected={false}
                  onPress={() => navigation.navigate('AddEntry', { type: 'measurement' })}
                />
                <SelectPill
                  label="+ Temp"
                  selected={false}
                  onPress={() => navigation.navigate('AddEntry', { type: 'temperature' })}
                />
                <SelectPill
                  label="+ Diaper"
                  selected={false}
                  onPress={() => navigation.navigate('AddEntry', { type: 'diaper' })}
                />
              </Row>
              <Button title="Refresh Logs" variant="secondary" onPress={load} />
            </Card>

            <Card title="Today At A Glance">
              <Row>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{glance.entriesToday}</Text>
                  <Text style={styles.statLabel}>entries</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{glance.feedsToday}</Text>
                  <Text style={styles.statLabel}>feeds</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{glance.diapersToday}</Text>
                  <Text style={styles.statLabel}>diapers</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{glance.latestTemp}</Text>
                  <Text style={styles.statLabel}>latest {tempUnit.toUpperCase()}</Text>
                </View>
              </Row>
            </Card>

            <Card title="Alerts">
              {alerts.length ? (
                alerts.map((item, idx) => (
                  <Text
                    key={`${item.level}-${idx}`}
                    style={[styles.alertItem, item.level === 'critical' ? styles.alertCritical : styles.alertWarning]}
                  >
                    {item.level === 'critical' ? 'Critical: ' : 'Warning: '}
                    {item.message}
                  </Text>
                ))
              ) : (
                <Text style={styles.alertOk}>No active alerts right now.</Text>
              )}
            </Card>

            <Card title="Activity Heatmap (Last 6 Weeks)">
              <View style={styles.heatWrap}>
                {dailyCounts.map((item) => (
                  <View
                    key={item.day}
                    style={[styles.heatCell, { backgroundColor: heatColor(item.count) }]}
                  />
                ))}
              </View>
              <Row>
                <Text style={styles.heatLabel}>Less</Text>
                <View style={[styles.heatCell, { backgroundColor: '#e5e7eb' }]} />
                <View style={[styles.heatCell, { backgroundColor: '#bfdbfe' }]} />
                <View style={[styles.heatCell, { backgroundColor: '#60a5fa' }]} />
                <View style={[styles.heatCell, { backgroundColor: '#2563eb' }]} />
                <Text style={styles.heatLabel}>More</Text>
              </Row>
            </Card>

            <Card title="Filter">
              <Text style={styles.filterTitle}>Range</Text>
              <Row>
                <SelectPill label="today" selected={rangePreset === 'today'} onPress={() => setRangePreset('today')} />
                <SelectPill label="7d" selected={rangePreset === '7d'} onPress={() => setRangePreset('7d')} />
                <SelectPill label="30d" selected={rangePreset === '30d'} onPress={() => setRangePreset('30d')} />
                <SelectPill label="all" selected={rangePreset === 'all'} onPress={() => setRangePreset('all')} />
              </Row>

              <Text style={styles.filterTitle}>Type</Text>
              <Row>
                {filters.map((option) => (
                  <SelectPill
                    key={option}
                    label={option}
                    selected={filter === option}
                    onPress={() => setFilter(option)}
                  />
                ))}
              </Row>
              <Input
                value={search}
                onChangeText={setSearch}
                placeholder="Search notes, type, details..."
                style={{ marginTop: 10 }}
              />
              <Text style={styles.hint}>Tap to edit. Long press to delete.</Text>
            </Card>

            <Card title="Export Filtered View">
              <Text style={styles.hint}>Exports current range and type filter.</Text>
              <Row>
                <Button title="PDF" onPress={() => onExportFiltered('pdf')} />
                <Button title="Excel" variant="secondary" onPress={() => onExportFiltered('excel')} />
              </Row>
            </Card>

            <Card title="Filtered Snapshot">
              <Row>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{visible.length}</Text>
                  <Text style={styles.statLabel}>entries</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{filteredCounts.feed}</Text>
                  <Text style={styles.statLabel}>feeds</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{filteredCounts.measurement}</Text>
                  <Text style={styles.statLabel}>growth</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{filteredCounts.temperature}</Text>
                  <Text style={styles.statLabel}>temp</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{filteredCounts.diaper}</Text>
                  <Text style={styles.statLabel}>diaper</Text>
                </View>
              </Row>
            </Card>
          </View>
        }
        renderItem={({ item, index }) => {
          const itemDay = item.timestamp.slice(0, 10);
          const prevDay = index > 0 ? visible[index - 1].timestamp.slice(0, 10) : '';
          const showDayHeader = itemDay !== prevDay;

          return (
            <>
              {showDayHeader ? (
                <Text style={styles.dayHeader}>
                  {new Date(`${itemDay}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              ) : null}
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate('AddEntry', { type: item.kind, entryId: item.id })}
                onLongPress={() => onDelete(item)}
              >
                <View style={styles.rowHead}>
                  <Text style={styles.kind}>{item.kind.toUpperCase()}</Text>
                  <Pressable onPress={() => togglePin(item)} hitSlop={8}>
                    <Ionicons
                      name={pinned.includes(logKey(item)) ? 'star' : 'star-outline'}
                      size={18}
                      color={pinned.includes(logKey(item)) ? '#f59e0b' : '#94a3b8'}
                    />
                  </Pressable>
                </View>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.sub}>{formatDateTime(item.timestamp)}</Text>
                <Text style={styles.sub}>{item.subtitle || '—'}</Text>
                {item.notes ? <Text style={styles.sub}>{item.notes}</Text> : null}
              </Pressable>
            </>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={<Text style={styles.empty}>No entries yet.</Text>}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  headerWrap: { paddingTop: 16, gap: 8 },
  hint: { color: '#6b7280', fontSize: 12, marginTop: 4 },
  filterTitle: { color: '#475569', fontWeight: '600', marginTop: 8, marginBottom: 6 },
  dayHeader: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
    marginLeft: 4,
  },
  statBox: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 72,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, color: '#64748b' },
  alertItem: {
    fontSize: 13,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  alertWarning: {
    backgroundColor: '#fffbeb',
    color: '#92400e',
  },
  alertCritical: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
  },
  alertOk: {
    fontSize: 13,
    color: '#065f46',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  heatWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  heatCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  heatLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  kind: { color: '#2563eb', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  title: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  sub: { fontSize: 13, color: '#4b5563' },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
});
