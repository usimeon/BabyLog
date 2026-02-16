import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Switch, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../app/navigation';
import { Button, Card, Input, Label, Row, SelectPill } from '../components/ui';
import { useAppContext } from '../context/AppContext';
import { addFeed, FeedInput, getFeedById, updateFeed } from '../db/feedRepo';
import { addMeasurement, getMeasurementById, updateMeasurement } from '../db/measurementRepo';
import { addTemperatureLog, getTemperatureById, updateTemperatureLog } from '../db/temperatureRepo';
import { addDiaperLog, getDiaperById, updateDiaperLog } from '../db/diaperRepo';
import { addMedicationLog, getMedicationById, updateMedicationLog } from '../db/medicationRepo';
import { addMilestone, getMilestoneById, updateMilestone } from '../db/milestoneRepo';
import { MedicationDoseUnit, PoopSize } from '../types/models';
import { cToDisplay, displayToC, displayToKg, displayToMl, kgToDisplay, mlToDisplay } from '../utils/units';
import { recalculateReminder } from '../services/reminderCoordinator';

type EntryType = 'feed' | 'measurement' | 'temperature' | 'diaper' | 'medication' | 'milestone';

const feedTypes: FeedInput['type'][] = ['breast', 'bottle', 'formula', 'solids'];
const feedSides: FeedInput['side'][] = ['left', 'right', 'both', 'none'];
const poopSizes: PoopSize[] = ['small', 'medium', 'large'];
const doseUnits: MedicationDoseUnit[] = ['ml', 'mg', 'drops', 'tablet'];

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

  const [medicationName, setMedicationName] = useState('');
  const [doseValue, setDoseValue] = useState('');
  const [doseUnit, setDoseUnit] = useState<MedicationDoseUnit>('ml');
  const [medIntervalHours, setMedIntervalHours] = useState('');
  const [medNotes, setMedNotes] = useState('');

  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneNotes, setMilestoneNotes] = useState('');
  const [milestonePhotoUri, setMilestonePhotoUri] = useState<string | null>(null);

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

      if (entryType === 'medication') {
        const m = await getMedicationById(entryId);
        if (!m) return;
        setTimestamp(new Date(m.timestamp));
        setMedicationName(m.medication_name);
        setDoseValue(String(m.dose_value));
        setDoseUnit(m.dose_unit);
        setMedIntervalHours(m.min_interval_hours ? String(m.min_interval_hours) : '');
        setMedNotes(m.notes ?? '');
      }

      if (entryType === 'milestone') {
        const m = await getMilestoneById(entryId);
        if (!m) return;
        setTimestamp(new Date(m.timestamp));
        setMilestoneTitle(m.title);
        setMilestoneNotes(m.notes ?? '');
        setMilestonePhotoUri(m.photo_uri ?? null);
      }
    };

    load();
  }, [entryId, entryType, amountUnit, weightUnit, tempUnit]);

  const pickMilestonePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Photo library permission is needed to attach milestone images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets.length) {
      setMilestonePhotoUri(result.assets[0].uri);
    }
  };

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

      if (entryType === 'medication') {
        if (!medicationName.trim()) throw new Error('Medication name is required.');
        const parsedDose = Number(doseValue);
        if (!Number.isFinite(parsedDose) || parsedDose <= 0) {
          throw new Error('Dose must be a valid number greater than zero.');
        }
        const interval = medIntervalHours ? Number(medIntervalHours) : null;
        if (interval !== null && (!Number.isFinite(interval) || interval <= 0)) {
          throw new Error('Minimum interval must be a positive number of hours.');
        }

        const payload = {
          timestamp: timestamp.toISOString(),
          medication_name: medicationName.trim(),
          dose_value: parsedDose,
          dose_unit: doseUnit,
          min_interval_hours: interval,
          notes: medNotes || null,
        };

        if (entryId) {
          await updateMedicationLog(entryId, payload);
        } else {
          await addMedicationLog(babyId, payload);
        }
      }

      if (entryType === 'milestone') {
        if (!milestoneTitle.trim()) throw new Error('Milestone title is required.');
        const payload = {
          timestamp: timestamp.toISOString(),
          title: milestoneTitle.trim(),
          notes: milestoneNotes || null,
          photo_uri: milestonePhotoUri,
        };

        if (entryId) {
          await updateMilestone(entryId, payload);
        } else {
          await addMilestone(babyId, payload);
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
            <SelectPill
              label="Medication"
              selected={entryType === 'medication'}
              onPress={() => !isEditing && setEntryType('medication')}
            />
            <SelectPill
              label="Milestone"
              selected={entryType === 'milestone'}
              onPress={() => !isEditing && setEntryType('milestone')}
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

        {entryType === 'medication' ? (
          <Card title="Medication Details">
            <Label>Medication name</Label>
            <Input value={medicationName} onChangeText={setMedicationName} placeholder="Tylenol" />

            <Label>Dose value</Label>
            <Input value={doseValue} onChangeText={setDoseValue} keyboardType="decimal-pad" placeholder="2.5" />

            <Label>Dose unit</Label>
            <Row>
              {doseUnits.map((unit) => (
                <SelectPill key={unit} label={unit} selected={doseUnit === unit} onPress={() => setDoseUnit(unit)} />
              ))}
            </Row>

            <Label>Minimum spacing (hours)</Label>
            <Input
              value={medIntervalHours}
              onChangeText={setMedIntervalHours}
              keyboardType="decimal-pad"
              placeholder="Optional (e.g. 4)"
            />

            <Label>Notes</Label>
            <Input value={medNotes} onChangeText={setMedNotes} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
          </Card>
        ) : null}

        {entryType === 'milestone' ? (
          <Card title="Milestone Details">
            <Label>Title</Label>
            <Input value={milestoneTitle} onChangeText={setMilestoneTitle} placeholder="First smile" />

            <Label>Notes</Label>
            <Input
              value={milestoneNotes}
              onChangeText={setMilestoneNotes}
              multiline
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />

            <Row>
              <Button title={milestonePhotoUri ? 'Change Photo' : 'Attach Photo'} onPress={pickMilestonePhoto} variant="secondary" />
              {milestonePhotoUri ? (
                <Button title="Remove Photo" onPress={() => setMilestonePhotoUri(null)} variant="danger" />
              ) : null}
            </Row>
            {milestonePhotoUri ? <Image source={{ uri: milestonePhotoUri }} style={styles.photoPreview} /> : null}
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
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
});
