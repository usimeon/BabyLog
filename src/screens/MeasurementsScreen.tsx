import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../app/navigation';
import { Button } from '../components/ui';
import { listMeasurements, softDeleteMeasurement } from '../db/measurementRepo';
import { useAppContext } from '../context/AppContext';
import { formatWeight } from '../utils/units';
import { formatDateTime } from '../utils/time';

export const MeasurementsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { babyId, weightUnit, syncNow, bumpDataVersion, dataVersion } = useAppContext();
  const [items, setItems] = useState<any[]>([]);

  const load = useCallback(async () => {
    const rows = await listMeasurements(babyId);
    setItems(rows);
  }, [babyId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  React.useEffect(() => {
    load();
  }, [dataVersion, load]);

  const onDelete = (id: string) => {
    Alert.alert('Delete measurement', 'Remove this measurement?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await softDeleteMeasurement(id);
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
          <View style={styles.headerWrap}>
            <Button title="Add Measurement Entry" onPress={() => navigation.navigate('AddEntry', { type: 'measurement' })} />
            <Text style={styles.hint}>Long press an item to delete.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onLongPress={() => onDelete(item.id)}>
            <Text style={styles.main}>{formatWeight(item.weight_kg, weightUnit)}</Text>
            <Text style={styles.sub}>{formatDateTime(item.timestamp)}</Text>
            <Text style={styles.sub}>Length: {item.length_cm ?? '—'} cm • Head: {item.head_circumference_cm ?? '—'} cm</Text>
            {item.notes ? <Text style={styles.sub}>{item.notes}</Text> : null}
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={<Text style={styles.empty}>No measurements yet.</Text>}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  headerWrap: { paddingVertical: 16, gap: 8 },
  hint: { color: '#6b7280', fontSize: 12 },
  row: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
  },
  main: { fontSize: 16, fontWeight: '700', color: '#111827' },
  sub: { color: '#4b5563', fontSize: 13, marginTop: 2 },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
});
