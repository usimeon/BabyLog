import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Row, SelectPill } from '../components/ui';
import { listFeeds, softDeleteFeed } from '../db/feedRepo';
import { useAppContext } from '../context/AppContext';
import { formatDateTime } from '../utils/time';
import { formatAmount } from '../utils/units';
import { recalculateReminder } from '../services/reminderCoordinator';

const filters = ['all', 'breast', 'bottle', 'formula', 'solids'] as const;

export const FeedHistoryScreen = () => {
  const { babyId, amountUnit, reminderSettings, syncNow, bumpDataVersion, dataVersion } = useAppContext();
  const [typeFilter, setTypeFilter] = useState<(typeof filters)[number]>('all');
  const [items, setItems] = useState<any[]>([]);

  const load = useCallback(async () => {
    const rows = await listFeeds(babyId, { type: typeFilter });
    setItems(rows);
  }, [babyId, typeFilter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  React.useEffect(() => {
    load();
  }, [dataVersion, load]);

  const onDelete = async (id: string) => {
    Alert.alert('Delete feed', 'Remove this feed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await softDeleteFeed(id);
          await recalculateReminder(babyId, reminderSettings);
          await syncNow();
          bumpDataVersion();
          load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ padding: 16, paddingBottom: 6 }}>
            <Card>
              <Text style={styles.header}>Filter</Text>
              <Row>
                {filters.map((f) => (
                  <SelectPill key={f} label={f} selected={typeFilter === f} onPress={() => setTypeFilter(f)} />
                ))}
              </Row>
              <Button title="Apply" onPress={load} variant="secondary" />
            </Card>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onLongPress={() => onDelete(item.id)}>
            <Text style={styles.type}>{item.type.toUpperCase()}</Text>
            <Text style={styles.sub}>{formatDateTime(item.timestamp)}</Text>
            <Text style={styles.sub}>
              {formatAmount(item.amount_ml, amountUnit)} • {item.duration_minutes ?? 0} min • {item.side}
            </Text>
            {item.notes ? <Text style={styles.sub}>{item.notes}</Text> : null}
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={<Text style={styles.empty}>No feeds yet.</Text>}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  header: { fontWeight: '600', marginBottom: 8 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
  },
  type: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sub: { fontSize: 13, color: '#4b5563' },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
});
