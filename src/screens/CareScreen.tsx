import React, { useCallback, useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Input, Label, Row, SelectPill } from '../components/ui';
import { useAppContext } from '../context/AppContext';
import { addTemperatureLog, listTemperatureLogs, softDeleteTemperatureLog } from '../db/temperatureRepo';
import { addDiaperLog, listDiaperLogs, softDeleteDiaperLog } from '../db/diaperRepo';
import { PoopSize } from '../types/models';
import { formatDateTime } from '../utils/time';

const poopSizes: PoopSize[] = ['small', 'medium', 'large'];

export const CareScreen = () => {
  const { babyId, syncNow, bumpDataVersion, dataVersion } = useAppContext();

  const [tempTimestamp, setTempTimestamp] = useState(new Date());
  const [temperatureC, setTemperatureC] = useState('36.8');
  const [tempNotes, setTempNotes] = useState('');

  const [diaperTimestamp, setDiaperTimestamp] = useState(new Date());
  const [hadPee, setHadPee] = useState(true);
  const [hadPoop, setHadPoop] = useState(false);
  const [poopSize, setPoopSize] = useState<PoopSize>('small');
  const [diaperNotes, setDiaperNotes] = useState('');

  const [temps, setTemps] = useState<any[]>([]);
  const [diapers, setDiapers] = useState<any[]>([]);

  const load = useCallback(async () => {
    const [t, d] = await Promise.all([listTemperatureLogs(babyId), listDiaperLogs(babyId)]);
    setTemps(t);
    setDiapers(d);
  }, [babyId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [dataVersion, load]);

  const addTemp = async () => {
    const parsed = Number(temperatureC);
    if (!Number.isFinite(parsed)) {
      Alert.alert('Invalid temperature', 'Enter a valid temperature in C.');
      return;
    }

    await addTemperatureLog(babyId, {
      timestamp: tempTimestamp.toISOString(),
      temperature_c: parsed,
      notes: tempNotes || null,
    });
    await syncNow();
    bumpDataVersion();
    setTempNotes('');
    load();
  };

  const addDiaper = async () => {
    if (!hadPee && !hadPoop) {
      Alert.alert('Nothing selected', 'Enable pee and/or poop before saving.');
      return;
    }

    await addDiaperLog(babyId, {
      timestamp: diaperTimestamp.toISOString(),
      had_pee: hadPee ? 1 : 0,
      had_poop: hadPoop ? 1 : 0,
      poop_size: hadPoop ? poopSize : null,
      notes: diaperNotes || null,
    });
    await syncNow();
    bumpDataVersion();
    setDiaperNotes('');
    load();
  };

  const deleteTemp = (id: string) => {
    Alert.alert('Delete temperature log', 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await softDeleteTemperatureLog(id);
          await syncNow();
          bumpDataVersion();
          load();
        },
      },
    ]);
  };

  const deleteDiaper = (id: string) => {
    Alert.alert('Delete diaper log', 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await softDeleteDiaperLog(id);
          await syncNow();
          bumpDataVersion();
          load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card title="Temperature">
          <Label>Timestamp</Label>
          <DateTimePicker value={tempTimestamp} mode="datetime" onChange={(_, d) => d && setTempTimestamp(d)} />
          <Label>Temperature (C)</Label>
          <Input value={temperatureC} onChangeText={setTemperatureC} keyboardType="decimal-pad" />
          <Label>Notes</Label>
          <Input value={tempNotes} onChangeText={setTempNotes} />
          <Button title="Add Temperature" onPress={addTemp} />
        </Card>

        <Card title="Poop & Pee">
          <Label>Timestamp</Label>
          <DateTimePicker value={diaperTimestamp} mode="datetime" onChange={(_, d) => d && setDiaperTimestamp(d)} />
          <Row>
            <Text style={styles.label}>Pee</Text>
            <Switch value={hadPee} onValueChange={setHadPee} />
          </Row>
          <Row>
            <Text style={styles.label}>Poop</Text>
            <Switch value={hadPoop} onValueChange={setHadPoop} />
          </Row>
          {hadPoop ? (
            <>
              <Label>Poop size</Label>
              <Row>
                {poopSizes.map((size) => (
                  <SelectPill key={size} label={size} selected={poopSize === size} onPress={() => setPoopSize(size)} />
                ))}
              </Row>
            </>
          ) : null}
          <Label>Notes</Label>
          <Input value={diaperNotes} onChangeText={setDiaperNotes} />
          <Button title="Add Diaper Log" onPress={addDiaper} />
        </Card>

        <Card title="Recent Temperature Logs (long press to delete)">
          {temps.length ? (
            temps.slice(0, 12).map((item) => (
              <Text key={item.id} style={styles.item} onLongPress={() => deleteTemp(item.id)}>
                {formatDateTime(item.timestamp)} • {Number(item.temperature_c).toFixed(1)} C
                {item.notes ? ` • ${item.notes}` : ''}
              </Text>
            ))
          ) : (
            <Text style={styles.empty}>No temperature logs yet.</Text>
          )}
        </Card>

        <Card title="Recent Poop/Pee Logs (long press to delete)">
          {diapers.length ? (
            diapers.slice(0, 20).map((item) => (
              <Text key={item.id} style={styles.item} onLongPress={() => deleteDiaper(item.id)}>
                {formatDateTime(item.timestamp)} • {item.had_pee ? 'pee' : ''}
                {item.had_pee && item.had_poop ? ' + ' : ''}
                {item.had_poop ? `poop (${item.poop_size ?? 'small'})` : ''}
                {item.notes ? ` • ${item.notes}` : ''}
              </Text>
            ))
          ) : (
            <Text style={styles.empty}>No poop/pee logs yet.</Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  label: { color: '#374151', fontWeight: '500' },
  item: { color: '#1f2937', fontSize: 13, marginBottom: 8 },
  empty: { color: '#6b7280' },
});
