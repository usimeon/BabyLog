import React, { useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../app/navigation';
import { Button, Card, Input } from '../components/ui';
import { useAppContext } from '../context/AppContext';
import { parseVoiceEntry } from '../services/voiceEntryParser';
import { addFeed } from '../db/feedRepo';
import { addMeasurement } from '../db/measurementRepo';
import { addTemperatureLog } from '../db/temperatureRepo';
import { addDiaperLog } from '../db/diaperRepo';
import { addMedicationLog } from '../db/medicationRepo';
import { addMilestone } from '../db/milestoneRepo';
import { recalculateReminder } from '../services/reminderCoordinator';

const examples = [
  'Bottle feed 120 ml 15 min',
  'Temperature 101.3 F',
  'Weight 12.5 lb',
  'Diaper poop medium pee',
  'Medication Tylenol 2.5 ml every 4h',
  'Milestone first roll over',
];

export const VoiceQuickEntryScreen = ({ navigation }: NativeStackScreenProps<RootStackParamList, 'VoiceQuickEntry'>) => {
  const { babyId, reminderSettings, syncNow, bumpDataVersion } = useAppContext();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => parseVoiceEntry(text), [text]);

  const save = async () => {
    if (!parsed) {
      Alert.alert('Could not parse', 'Try an example phrase format shown below.');
      return;
    }

    try {
      setSaving(true);
      if (parsed.type === 'feed') {
        await addFeed(babyId, {
          timestamp: parsed.timestampIso,
          type: parsed.feedType,
          amount_ml: parsed.amountMl ?? null,
          duration_minutes: parsed.durationMinutes ?? null,
          side: parsed.side,
          notes: parsed.notes ?? null,
        });
        await recalculateReminder(babyId, reminderSettings);
      }

      if (parsed.type === 'measurement') {
        await addMeasurement(babyId, {
          timestamp: parsed.timestampIso,
          weight_kg: parsed.weightKg,
          notes: parsed.notes ?? null,
        });
      }

      if (parsed.type === 'temperature') {
        await addTemperatureLog(babyId, {
          timestamp: parsed.timestampIso,
          temperature_c: parsed.temperatureC,
          notes: parsed.notes ?? null,
        });
      }

      if (parsed.type === 'diaper') {
        await addDiaperLog(babyId, {
          timestamp: parsed.timestampIso,
          had_pee: parsed.hadPee ? 1 : 0,
          had_poop: parsed.hadPoop ? 1 : 0,
          poop_size: parsed.hadPoop ? parsed.poopSize : null,
          notes: parsed.notes ?? null,
        });
      }

      if (parsed.type === 'medication') {
        await addMedicationLog(babyId, {
          timestamp: parsed.timestampIso,
          medication_name: parsed.medicationName,
          dose_value: parsed.doseValue,
          dose_unit: parsed.doseUnit,
          min_interval_hours: parsed.minIntervalHours ?? null,
          notes: parsed.notes ?? null,
        });
      }

      if (parsed.type === 'milestone') {
        await addMilestone(babyId, {
          timestamp: parsed.timestampIso,
          title: parsed.title,
          notes: parsed.notes ?? null,
          photo_uri: null,
        });
      }

      await syncNow();
      bumpDataVersion();
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Save failed', error?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card title="Voice Quick Entry">
          <Text style={styles.sub}>Use iOS dictation from keyboard mic, then save.</Text>
          <Input
            multiline
            value={text}
            onChangeText={setText}
            placeholder="Say or type: Bottle feed 120 ml"
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />
          <Text style={styles.sub}>Detected type: {parsed?.type ?? 'not recognized'}</Text>
          <Button title={saving ? 'Saving...' : 'Save Parsed Entry'} onPress={save} />
        </Card>

        <Card title="Examples">
          {examples.map((item) => (
            <Text key={item} style={styles.example}>• {item}</Text>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 16, gap: 10 },
  sub: { color: '#475569', fontSize: 13, marginBottom: 8 },
  example: { color: '#1f2937', fontSize: 13, marginBottom: 6 },
});
