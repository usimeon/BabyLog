import React, { useEffect, useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Switch, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../app/navigation';
import { Button, Card, Input, Label, Row, SelectPill } from '../components/ui';
import { useAppContext } from '../context/AppContext';
import { addFeed, FeedInput, getFeedById, updateFeed } from '../db/feedRepo';
import { addMeasurement, getMeasurementById, updateMeasurement } from '../db/measurementRepo';
import { addTemperatureLog, getTemperatureById, updateTemperatureLog } from '../db/temperatureRepo';
import { addDiaperLog, getDiaperById, updateDiaperLog } from '../db/diaperRepo';
import { PoopSize } from '../types/models';
import { cToDisplay, displayToC, displayToKg, displayToMl, kgToDisplay, mlToDisplay } from '../utils/units';
import { recalculateReminder } from '../services/reminderCoordinator';

type EntryType = 'feed' | 'measurement' | 'temperature' | 'diaper';

const feedTypes: FeedInput['type'][] = ['breast', 'bottle', 'formula', 'solids'];
const feedSides: FeedInput['side'][] = ['left', 'right', 'both', 'none'];
const poopSizes: PoopSize[] = ['small', 'medium', 'large'];

export const AddEntryScreen = ({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'AddEntry'>) => {
  const { babyId, amountUnit, weightUnit, tempUnit, reminderSettings, syncNow, bumpDataVersion } = useAppContext();
  const initialType = (route.params?.type as EntryType | undefined) ?? 'feed';
  const entryId = route.params?.entryId;
  const isEditing = Boolean(entryId);

  const [entryType, setEntryType] = useState<EntryType>(initialType);
  const [timestamp, setTimestamp] = useState(new Date());
  const [busy, setBusy] = useState(false);

  const [feedType, setFeedType] = useState<FeedInput['type']>('bottle');
  const [feedAmount, setFeedAmount] = useState('');
  const [feedDuration, setFeedDuration] = useState('');
  const [feedSide, setFeedSide] = useState<FeedInput['side']>('none');
  const [feedNotes, setFeedNotes] = useState('');

  const [weight, setWeight] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [headCm, setHeadCm] = useState('');
  const [measurementNotes, setMeasurementNotes] = useState('');

  const [temperatureC, setTemperatureC] = useState('36.8');
  const [temperatureNotes, setTemperatureNotes] = useState('');

  const [hadPee, setHadPee] = useState(true);
  const [hadPoop, setHadPoop] = useState(false);
  const [poopSize, setPoopSize] = useState<PoopSize>('small');
  const [diaperNotes, setDiaperNotes] = useState('');

  const canHaveAmount = useMemo(() => feedType === 'bottle' || feedType === 'formula' || feedType === 'solids', [feedType]);

  useEffect(() => {
    if (!entryId) return;

    const load = async () => {
      if (entryType === 'feed') {
        const feed = await getFeedById(entryId);
        if (!feed) return;
        setTimestamp(new Date(feed.timestamp));
        setFeedType(feed.type);
        setFeedAmount(feed.amount_ml ? String(mlToDisplay(feed.amount_ml, amountUnit).toFixed(1)) : '');
        setFeedDuration(feed.duration_minutes ? String(feed.duration_minutes) : '');
        setFeedSide(feed.side);
        setFeedNotes(feed.notes ?? '');
      }

      if (entryType === 'measurement') {
        const m = await getMeasurementById(entryId);
        if (!m) return;
        setTimestamp(new Date(m.timestamp));
        setWeight(String(kgToDisplay(m.weight_kg, weightUnit).toFixed(2)));
        setLengthCm(m.length_cm ? String(m.length_cm) : '');
        setHeadCm(m.head_circumference_cm ? String(m.head_circumference_cm) : '');
        setMeasurementNotes(m.notes ?? '');
      }

      if (entryType === 'temperature') {
        const t = await getTemperatureById(entryId);
        if (!t) return;
        setTimestamp(new Date(t.timestamp));
        setTemperatureC(String(cToDisplay(Number(t.temperature_c), tempUnit).toFixed(1)));
        setTemperatureNotes(t.notes ?? '');
      }

      if (entryType === 'diaper') {
        const d = await getDiaperById(entryId);
        if (!d) return;
        setTimestamp(new Date(d.timestamp));
        setHadPee(Boolean(d.had_pee));
        setHadPoop(Boolean(d.had_poop));
        setPoopSize((d.poop_size as PoopSize) ?? 'small');
        setDiaperNotes(d.notes ?? '');
      }
    };

    load();
  }, [entryId, entryType, amountUnit, weightUnit, tempUnit]);

  const save = async () => {
    try {
      setBusy(true);

      if (entryType === 'feed') {
        const amountMl = canHaveAmount && feedAmount ? displayToMl(Number(feedAmount), amountUnit) : null;
        const payload: FeedInput = {
          timestamp: timestamp.toISOString(),
          type: feedType,
          amount_ml: Number.isFinite(amountMl as number) ? amountMl : null,
          duration_minutes: feedDuration ? Number(feedDuration) : null,
          side: feedSide,
          notes: feedNotes || null,
        };
        if (entryId) {
          await updateFeed(entryId, payload);
        } else {
          await addFeed(babyId, payload);
        }
        await recalculateReminder(babyId, reminderSettings);
      }

      if (entryType === 'measurement') {
        const parsedWeight = Number(weight);
        if (!Number.isFinite(parsedWeight)) {
          throw new Error(`Enter a valid weight in ${weightUnit}.`);
        }

        const payload = {
          timestamp: timestamp.toISOString(),
          weight_kg: displayToKg(parsedWeight, weightUnit),
          length_cm: lengthCm ? Number(lengthCm) : null,
          head_circumference_cm: headCm ? Number(headCm) : null,
          notes: measurementNotes || null,
        };

        if (entryId) {
          await updateMeasurement(entryId, payload);
        } else {
          await addMeasurement(babyId, payload);
        }
      }

      if (entryType === 'temperature') {
        const parsedDisplayTemp = Number(temperatureC);
        if (!Number.isFinite(parsedDisplayTemp)) {
          throw new Error(`Enter a valid temperature in ${tempUnit.toUpperCase()}.`);
        }

        const payload = {
          timestamp: timestamp.toISOString(),
          temperature_c: displayToC(parsedDisplayTemp, tempUnit),
          notes: temperatureNotes || null,
        };

        if (entryId) {
          await updateTemperatureLog(entryId, payload);
        } else {
          await addTemperatureLog(babyId, payload);
        }
      }

      if (entryType === 'diaper') {
        if (!hadPee && !hadPoop) {
          throw new Error('Enable pee and/or poop before saving.');
        }

        const payload = {
          timestamp: timestamp.toISOString(),
          had_pee: hadPee ? 1 : 0,
          had_poop: hadPoop ? 1 : 0,
          poop_size: hadPoop ? poopSize : null,
          notes: diaperNotes || null,
        };

        if (entryId) {
          await updateDiaperLog(entryId, payload);
        } else {
          await addDiaperLog(babyId, payload);
        }
      }

      await syncNow();
      bumpDataVersion();
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Could not save entry', error?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card title="Entry Type">
          <Row>
            <SelectPill label="Feed" selected={entryType === 'feed'} onPress={() => !isEditing && setEntryType('feed')} />
            <SelectPill
              label="Weight"
              selected={entryType === 'measurement'}
              onPress={() => !isEditing && setEntryType('measurement')}
            />
            <SelectPill
              label="Temp"
              selected={entryType === 'temperature'}
              onPress={() => !isEditing && setEntryType('temperature')}
            />
            <SelectPill
              label="Poop/Pee"
              selected={entryType === 'diaper'}
              onPress={() => !isEditing && setEntryType('diaper')}
            />
          </Row>

          {isEditing ? <Text style={styles.hint}>Editing existing entry. Type is locked for data safety.</Text> : null}

          <Label>Timestamp</Label>
          <DateTimePicker value={timestamp} mode="datetime" onChange={(_, d) => d && setTimestamp(d)} />
        </Card>

        {entryType === 'feed' ? (
          <Card title="Feed Details">
            <Label>Feed type</Label>
            <Row>
              {feedTypes.map((option) => (
                <SelectPill key={option} label={option} selected={feedType === option} onPress={() => setFeedType(option)} />
              ))}
            </Row>

            <Label>Amount ({amountUnit})</Label>
            <Input
              value={feedAmount}
              onChangeText={setFeedAmount}
              keyboardType="decimal-pad"
              placeholder={canHaveAmount ? `Enter ${amountUnit}` : 'Optional'}
            />

            <Label>Duration (minutes)</Label>
            <Input value={feedDuration} onChangeText={setFeedDuration} keyboardType="number-pad" />

            <Label>Side</Label>
            <Row>
              {feedSides.map((option) => (
                <SelectPill key={option} label={option} selected={feedSide === option} onPress={() => setFeedSide(option)} />
              ))}
            </Row>

            <Label>Notes</Label>
            <Input value={feedNotes} onChangeText={setFeedNotes} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
          </Card>
        ) : null}

        {entryType === 'measurement' ? (
          <Card title="Measurement Details">
            <Label>Weight ({weightUnit})</Label>
            <Input value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />

            <Label>Length (cm)</Label>
            <Input value={lengthCm} onChangeText={setLengthCm} keyboardType="decimal-pad" />

            <Label>Head circumference (cm)</Label>
            <Input value={headCm} onChangeText={setHeadCm} keyboardType="decimal-pad" />

            <Label>Notes</Label>
            <Input
              value={measurementNotes}
              onChangeText={setMeasurementNotes}
              multiline
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          </Card>
        ) : null}

        {entryType === 'temperature' ? (
          <Card title="Temperature Details">
            <Label>Temperature ({tempUnit.toUpperCase()})</Label>
            <Input value={temperatureC} onChangeText={setTemperatureC} keyboardType="decimal-pad" />

            <Label>Notes</Label>
            <Input
              value={temperatureNotes}
              onChangeText={setTemperatureNotes}
              multiline
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          </Card>
        ) : null}

        {entryType === 'diaper' ? (
          <Card title="Poop/Pee Details">
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
          </Card>
        ) : null}

        <Button title={busy ? 'Saving...' : isEditing ? 'Update Entry' : 'Save Entry'} onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 16, gap: 10 },
  label: { color: '#374151', fontWeight: '500' },
  hint: { color: '#64748b', fontSize: 12, marginTop: 8 },
});
