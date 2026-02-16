import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../app/navigation';
import { Button, Card, Input, Row, SelectPill } from '../components/ui';
import { useAppContext } from '../context/AppContext';
import { listFeeds, softDeleteFeed } from '../db/feedRepo';
import { listMeasurements, softDeleteMeasurement } from '../db/measurementRepo';
import { listTemperatureLogs, softDeleteTemperatureLog } from '../db/temperatureRepo';
import { listDiaperLogs, softDeleteDiaperLog } from '../db/diaperRepo';
import { recalculateReminder } from '../services/reminderCoordinator';
import { formatDateTime, startOfDay } from '../utils/time';
import { formatAmount, formatWeight } from '../utils/units';

type LogFilter = 'all' | 'feed' | 'measurement' | 'temperature' | 'diaper';

type LogEntry = {
  id: string;
  kind: Exclude<LogFilter, 'all'>;
  timestamp: string;
  title: string;
  subtitle: string;
  notes?: string | null;
};

const filters: LogFilter[] = ['all', 'feed', 'measurement', 'temperature', 'diaper'];

type GlanceStats = {
  feedsToday: number;
  diapersToday: number;
  latestTempC: string;
  entriesToday: number;
};

export const LogsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { babyId, amountUnit, weightUnit, reminderSettings, syncNow, bumpDataVersion, dataVersion } = useAppContext();
  const [filter, setFilter] = useState<LogFilter>('all');
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [glance, setGlance] = useState<GlanceStats>({
    feedsToday: 0,
    diapersToday: 0,
    latestTempC: '—',
    entriesToday: 0,
  });

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
        title: `Temp • ${Number(item.temperature_c).toFixed(1)} C`,
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
      latestTempC: temps.length ? Number(temps[0].temperature_c).toFixed(1) : '—',
      entriesToday: mapped.filter((x) => new Date(x.timestamp).getTime() >= dayStart).length,
    });
  }, [babyId, amountUnit, weightUnit]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [dataVersion, load]);

  const visible = useMemo(() => {
    const typed = filter === 'all' ? entries : entries.filter((x) => x.kind === filter);
    const query = search.trim().toLowerCase();
    if (!query) return typed;
    return typed.filter((x) => {
      const text = `${x.kind} ${x.title} ${x.subtitle} ${x.notes ?? ''}`.toLowerCase();
      return text.includes(query);
    });
  }, [entries, filter, search]);

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
                  <Text style={styles.statValue}>{glance.latestTempC}</Text>
                  <Text style={styles.statLabel}>latest C</Text>
                </View>
              </Row>
            </Card>

            <Card title="Filter">
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
              <Text style={styles.hint}>Long press an entry to delete.</Text>
            </Card>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onLongPress={() => onDelete(item)}>
            <Text style={styles.kind}>{item.kind.toUpperCase()}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.sub}>{formatDateTime(item.timestamp)}</Text>
            <Text style={styles.sub}>{item.subtitle || '—'}</Text>
            {item.notes ? <Text style={styles.sub}>{item.notes}</Text> : null}
          </Pressable>
        )}
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
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
  },
  kind: { color: '#2563eb', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  title: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  sub: { fontSize: 13, color: '#4b5563' },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
});
