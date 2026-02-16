import React, { useCallback, useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../app/navigation';
import { Button, Card } from '../components/ui';
import { useAppContext } from '../context/AppContext';
import { listTemperatureLogs, softDeleteTemperatureLog } from '../db/temperatureRepo';
import { listDiaperLogs, softDeleteDiaperLog } from '../db/diaperRepo';
import { formatDateTime } from '../utils/time';

export const CareScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { babyId, syncNow, bumpDataVersion, dataVersion } = useAppContext();

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
        <Card title="Add Care Entries">
          <Button title="Add Temperature Entry" onPress={() => navigation.navigate('AddEntry', { type: 'temperature' })} />
          <Button title="Add Poop/Pee Entry" variant="secondary" onPress={() => navigation.navigate('AddEntry', { type: 'diaper' })} />
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
  item: { color: '#1f2937', fontSize: 13, marginBottom: 8 },
  empty: { color: '#6b7280' },
});
