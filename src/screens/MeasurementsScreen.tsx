import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Input, Label } from '../components/ui';
import { addMeasurement, listMeasurements, softDeleteMeasurement, updateMeasurement } from '../db/measurementRepo';
import { useAppContext } from '../context/AppContext';
import { displayToKg, formatWeight, kgToDisplay } from '../utils/units';
import { formatDateTime } from '../utils/time';

export const MeasurementsScreen = () => {
  const { babyId, weightUnit, syncNow, bumpDataVersion, dataVersion } = useAppContext();
  const [items, setItems] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [timestamp, setTimestamp] = useState(new Date());
  const [weight, setWeight] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [headCm, setHeadCm] = useState('');
  const [notes, setNotes] = useState('');

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

  const reset = () => {
    setEditingId(null);
    setTimestamp(new Date());
    setWeight('');
    setLengthCm('');
    setHeadCm('');
    setNotes('');
  };

  const onSave = async () => {
    const parsedWeight = Number(weight);
    if (!Number.isFinite(parsedWeight)) {
      Alert.alert('Weight required', `Enter a valid weight in ${weightUnit}.`);
      return;
    }

    const payload = {
      timestamp: timestamp.toISOString(),
      weight_kg: displayToKg(parsedWeight, weightUnit),
      length_cm: lengthCm ? Number(lengthCm) : null,
      head_circumference_cm: headCm ? Number(headCm) : null,
      notes: notes || null,
    };

    if (editingId) {
      await updateMeasurement(editingId, payload);
    } else {
      await addMeasurement(babyId, payload);
    }

    await syncNow();
    bumpDataVersion();
    reset();
    load();
  };

  const onEdit = (item: any) => {
    setEditingId(item.id);
    setTimestamp(new Date(item.timestamp));
    setWeight(String(kgToDisplay(item.weight_kg, weightUnit).toFixed(2)));
    setLengthCm(item.length_cm ? String(item.length_cm) : '');
    setHeadCm(item.head_circumference_cm ? String(item.head_circumference_cm) : '');
    setNotes(item.notes ?? '');
  };

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
          <View style={{ padding: 16, paddingBottom: 6 }}>
            <Card title={editingId ? 'Edit Measurement' : 'Add Measurement'}>
              <Label>Timestamp</Label>
              <DateTimePicker value={timestamp} onChange={(_, next) => next && setTimestamp(next)} mode="datetime" />

              <Label>Weight ({weightUnit})</Label>
              <Input value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />

              <Label>Length (cm)</Label>
              <Input value={lengthCm} onChangeText={setLengthCm} keyboardType="decimal-pad" />

              <Label>Head circumference (cm)</Label>
              <Input value={headCm} onChangeText={setHeadCm} keyboardType="decimal-pad" />

              <Label>Notes</Label>
              <Input value={notes} onChangeText={setNotes} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />

              <Button title={editingId ? 'Update Measurement' : 'Save Measurement'} onPress={onSave} />
              {editingId ? <Button title="Cancel Edit" variant="secondary" onPress={reset} /> : null}
            </Card>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onEdit(item)} onLongPress={() => onDelete(item.id)}>
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
