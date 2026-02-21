import React, { useEffect, useMemo, useState } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Switch, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../app/navigation';
import { Button, Card, Input, Label, Row, SelectPill } from '../components/ui';
import { ToastBanner, ToastBannerKind } from '../components/ToastBanner';
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
import { useAppTheme } from '../theme/useAppTheme';
import { getTheme } from '../theme/designSystem';

type EntryType = 'feed' | 'measurement' | 'temperature' | 'diaper' | 'medication' | 'milestone';
type AddEntryField =
  | 'timestamp'
  | 'feedAmount'
  | 'feedDuration'
  | 'feedSide'
  | 'feedNotes'
  | 'weight'
  | 'lengthCm'
  | 'headCm'
  | 'measurementNotes'
  | 'temperature'
  | 'temperatureNotes'
  | 'diaperType'
  | 'diaperNotes'
  | 'medicationName'
  | 'doseValue'
  | 'medIntervalHours'
  | 'medNotes'
  | 'milestoneTitle'
  | 'milestoneNotes'
  | 'milestonePhoto';

const feedTypes: FeedInput['type'][] = ['breast', 'bottle', 'formula', 'solids'];
const feedSides: FeedInput['side'][] = ['left', 'right', 'both', 'none'];
const poopSizes: PoopSize[] = ['small', 'medium', 'large'];
const doseUnits: MedicationDoseUnit[] = ['ml', 'mg', 'drops', 'tablet'];
const MAX_NOTES_LENGTH = 2000;
const MAX_NAME_LENGTH = 120;
const MAX_MILESTONE_TITLE_LENGTH = 160;
const MAX_PHOTO_URI_LENGTH = 2000;
const MAX_FUTURE_TIMESTAMP_MS = 5 * 60 * 1000;

export const AddEntryScreen = ({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'AddEntry'>) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { babyId, amountUnit, weightUnit, tempUnit, reminderSettings, syncNow, bumpDataVersion } = useAppContext();
  const initialType = (route.params?.type as EntryType | undefined) ?? 'feed';
  const entryId = route.params?.entryId;
  const isEditing = Boolean(entryId);

  const [entryType, setEntryType] = useState<EntryType>(initialType);
  const [timestamp, setTimestamp] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: ToastBannerKind; message: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AddEntryField, string>>>({});

  const [feedType, setFeedType] = useState<FeedInput['type']>('bottle');
  const [feedAmount, setFeedAmount] = useState('');
  const [feedDuration, setFeedDuration] = useState('');
  const [feedSide, setFeedSide] = useState<FeedInput['side']>('left');
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
  const feedAmountUnit = useMemo<'ml' | 'oz'>(() => (feedType === 'solids' ? 'oz' : amountUnit), [feedType, amountUnit]);

  const clearFieldError = (field: AddEntryField) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    if (!entryId) return;

    const load = async () => {
      if (entryType === 'feed') {
        const feed = await getFeedById(entryId);
        if (!feed) return;
        setTimestamp(new Date(feed.timestamp));
        setFeedType(feed.type);
        const loadedAmountUnit: 'ml' | 'oz' = feed.type === 'solids' ? 'oz' : amountUnit;
        setFeedAmount(feed.amount_ml ? String(mlToDisplay(feed.amount_ml, loadedAmountUnit).toFixed(1)) : '');
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

  useEffect(() => {
    if (!entryId) {
      setTimestamp(new Date());
    }
  }, [entryId, initialType]);

  useEffect(() => {
    setFieldErrors({});
  }, [entryType, entryId]);

  useEffect(() => {
    if (feedType === 'solids' && feedSide !== 'none') {
      setFeedSide('none');
    }
    if (feedType === 'breast' && feedSide === 'none') {
      setFeedSide('left');
    }
  }, [feedType, feedSide]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  const showToast = (message: string, kind: ToastBannerKind = 'info') => {
    setToast({ kind, message });
  };

  const pickMilestonePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Photo library permission is needed to attach milestone images.', 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets.length) {
      setMilestonePhotoUri(result.assets[0].uri);
      clearFieldError('milestonePhoto');
    }
  };

  const save = async () => {
    try {
      const nextErrors: Partial<Record<AddEntryField, string>> = {};
      const addError = (field: AddEntryField, message: string) => {
        if (!nextErrors[field]) nextErrors[field] = message;
      };
      const addTextLengthError = (field: AddEntryField, value: string, label: string, maxLength: number) => {
        if (value.trim().length > maxLength) {
          addError(field, `${label} must be ${maxLength} characters or fewer.`);
        }
      };

      if (Number.isNaN(timestamp.getTime())) {
        addError('timestamp', 'Timestamp is invalid.');
      } else if (timestamp.getTime() > Date.now() + MAX_FUTURE_TIMESTAMP_MS) {
        addError('timestamp', 'Timestamp cannot be in the future.');
      }

      let feedPayload: FeedInput | null = null;
      let measurementPayload:
        | {
            timestamp: string;
            weight_kg: number;
            length_cm: number | null;
            head_circumference_cm: number | null;
            notes: string | null;
          }
        | null = null;
      let temperaturePayload:
        | {
            timestamp: string;
            temperature_c: number;
            notes: string | null;
          }
        | null = null;
      let diaperPayload:
        | {
            timestamp: string;
            had_pee: 0 | 1;
            had_poop: 0 | 1;
            poop_size: PoopSize | null;
            notes: string | null;
          }
        | null = null;
      let medicationPayload:
        | {
            timestamp: string;
            medication_name: string;
            dose_value: number;
            dose_unit: MedicationDoseUnit;
            min_interval_hours: number | null;
            notes: string | null;
          }
        | null = null;
      let milestonePayload:
        | {
            timestamp: string;
            title: string;
            notes: string | null;
            photo_uri: string | null;
          }
        | null = null;

      if (entryType === 'feed') {
        const trimmedAmount = feedAmount.trim();
        const trimmedDuration = feedDuration.trim();

        let amountMl: number | null = null;
        if (canHaveAmount) {
          if (!trimmedAmount) {
            addError('feedAmount', `Amount is required in ${feedAmountUnit}.`);
          } else {
            const parsedAmount = Number(trimmedAmount);
            if (!Number.isFinite(parsedAmount)) {
              addError('feedAmount', `Enter a valid amount in ${feedAmountUnit}.`);
            } else {
              amountMl = displayToMl(parsedAmount, feedAmountUnit);
              if (!Number.isFinite(amountMl) || amountMl < 0.1 || amountMl > 2000) {
                addError('feedAmount', `Amount must be between 0.1 and 2000 ml.`);
              }
            }
          }
        } else if (trimmedAmount) {
          const parsedAmount = Number(trimmedAmount);
          if (!Number.isFinite(parsedAmount)) {
            addError('feedAmount', `Enter a valid amount in ${feedAmountUnit}.`);
          }
        }

        let durationValue: number | null = null;
        if (trimmedDuration) {
          const parsedDuration = Number(trimmedDuration);
          if (!Number.isInteger(parsedDuration)) {
            addError('feedDuration', 'Duration must be a whole number of minutes.');
          } else if (parsedDuration < 1 || parsedDuration > 1440) {
            addError('feedDuration', 'Duration must be between 1 and 1440 minutes.');
          } else {
            durationValue = parsedDuration;
          }
        }

        if (feedType === 'breast' && feedSide === 'none') {
          addError('feedSide', 'Select left, right, or both for breastfeeding.');
        }

        addTextLengthError('feedNotes', feedNotes, 'Feed notes', MAX_NOTES_LENGTH);

        if (!Object.keys(nextErrors).length) {
          feedPayload = {
            timestamp: timestamp.toISOString(),
            type: feedType,
            amount_ml: amountMl,
            duration_minutes: durationValue,
            side: feedSide,
            notes: feedNotes.trim() ? feedNotes.trim() : null,
          };
        }
      }

      if (entryType === 'measurement') {
        const trimmedWeight = weight.trim();
        const trimmedLength = lengthCm.trim();
        const trimmedHead = headCm.trim();

        let weightKg = 0;
        if (!trimmedWeight) {
          addError('weight', `Weight (${weightUnit}) is required.`);
        } else {
          const parsedWeight = Number(trimmedWeight);
          if (!Number.isFinite(parsedWeight)) {
            addError('weight', `Enter a valid weight in ${weightUnit}.`);
          } else {
            weightKg = displayToKg(parsedWeight, weightUnit);
            if (!Number.isFinite(weightKg) || weightKg < 0.2 || weightKg > 40) {
              addError('weight', 'Weight must be between 0.2 and 40 kg.');
            }
          }
        }

        let parsedLength: number | null = null;
        if (trimmedLength) {
          parsedLength = Number(trimmedLength);
          if (!Number.isFinite(parsedLength) || parsedLength < 10 || parsedLength > 150) {
            addError('lengthCm', 'Length must be between 10 and 150 cm.');
          }
        }

        let parsedHead: number | null = null;
        if (trimmedHead) {
          parsedHead = Number(trimmedHead);
          if (!Number.isFinite(parsedHead) || parsedHead < 10 || parsedHead > 80) {
            addError('headCm', 'Head circumference must be between 10 and 80 cm.');
          }
        }

        addTextLengthError('measurementNotes', measurementNotes, 'Measurement notes', MAX_NOTES_LENGTH);

        if (!Object.keys(nextErrors).length) {
          measurementPayload = {
            timestamp: timestamp.toISOString(),
            weight_kg: weightKg,
            length_cm: parsedLength,
            head_circumference_cm: parsedHead,
            notes: measurementNotes.trim() ? measurementNotes.trim() : null,
          };
        }
      }

      if (entryType === 'temperature') {
        const trimmedTemp = temperatureC.trim();
        if (!trimmedTemp) {
          addError('temperature', `Temperature (${tempUnit.toUpperCase()}) is required.`);
        } else {
          const parsedDisplayTemp = Number(trimmedTemp);
          if (!Number.isFinite(parsedDisplayTemp)) {
            addError('temperature', `Enter a valid temperature in ${tempUnit.toUpperCase()}.`);
          } else {
            const parsedC = displayToC(parsedDisplayTemp, tempUnit);
            if (!Number.isFinite(parsedC) || parsedC < 30 || parsedC > 45) {
              addError('temperature', 'Temperature must be between 30.0°C and 45.0°C.');
            } else {
              temperaturePayload = {
                timestamp: timestamp.toISOString(),
                temperature_c: parsedC,
                notes: temperatureNotes.trim() ? temperatureNotes.trim() : null,
              };
            }
          }
        }

        addTextLengthError('temperatureNotes', temperatureNotes, 'Temperature notes', MAX_NOTES_LENGTH);
      }

      if (entryType === 'diaper') {
        if (!hadPee && !hadPoop) {
          addError('diaperType', 'Enable pee and/or poop before saving.');
        }
        addTextLengthError('diaperNotes', diaperNotes, 'Diaper notes', MAX_NOTES_LENGTH);
        diaperPayload = {
          timestamp: timestamp.toISOString(),
          had_pee: hadPee ? 1 : 0,
          had_poop: hadPoop ? 1 : 0,
          poop_size: hadPoop ? poopSize : null,
          notes: diaperNotes.trim() ? diaperNotes.trim() : null,
        };
      }

      if (entryType === 'medication') {
        const trimmedName = medicationName.trim();
        const trimmedDose = doseValue.trim();
        const trimmedInterval = medIntervalHours.trim();
        if (!trimmedName) {
          addError('medicationName', 'Medication name is required.');
        } else if (trimmedName.length > MAX_NAME_LENGTH) {
          addError('medicationName', `Medication name must be ${MAX_NAME_LENGTH} characters or fewer.`);
        }

        let parsedDose = 0;
        if (!trimmedDose) {
          addError('doseValue', 'Dose value is required.');
        } else {
          parsedDose = Number(trimmedDose);
          if (!Number.isFinite(parsedDose) || parsedDose < 0.01 || parsedDose > 10000) {
            addError('doseValue', 'Dose must be between 0.01 and 10000.');
          }
        }

        let parsedInterval: number | null = null;
        if (trimmedInterval) {
          parsedInterval = Number(trimmedInterval);
          if (!Number.isFinite(parsedInterval) || parsedInterval < 0.1 || parsedInterval > 168) {
            addError('medIntervalHours', 'Minimum interval must be between 0.1 and 168 hours.');
          }
        }

        addTextLengthError('medNotes', medNotes, 'Medication notes', MAX_NOTES_LENGTH);

        if (!Object.keys(nextErrors).length) {
          medicationPayload = {
            timestamp: timestamp.toISOString(),
            medication_name: trimmedName,
            dose_value: parsedDose,
            dose_unit: doseUnit,
            min_interval_hours: parsedInterval,
            notes: medNotes.trim() ? medNotes.trim() : null,
          };
        }
      }

      if (entryType === 'milestone') {
        const trimmedTitle = milestoneTitle.trim();
        if (!trimmedTitle) {
          addError('milestoneTitle', 'Milestone title is required.');
        } else if (trimmedTitle.length > MAX_MILESTONE_TITLE_LENGTH) {
          addError('milestoneTitle', `Milestone title must be ${MAX_MILESTONE_TITLE_LENGTH} characters or fewer.`);
        }

        addTextLengthError('milestoneNotes', milestoneNotes, 'Milestone notes', MAX_NOTES_LENGTH);
        if (milestonePhotoUri && milestonePhotoUri.trim().length > MAX_PHOTO_URI_LENGTH) {
          addError('milestonePhoto', 'Photo reference is too long.');
        }

        if (!Object.keys(nextErrors).length) {
          milestonePayload = {
            timestamp: timestamp.toISOString(),
            title: trimmedTitle,
            notes: milestoneNotes.trim() ? milestoneNotes.trim() : null,
            photo_uri: milestonePhotoUri,
          };
        }
      }

      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        const firstError = Object.values(nextErrors)[0];
        if (firstError) showToast(firstError, 'error');
        return;
      }

      setFieldErrors({});
      setBusy(true);
      let warningText: string | null = null;

      if (entryType === 'feed' && feedPayload) {
        if (entryId) {
          await updateFeed(entryId, feedPayload);
        } else {
          await addFeed(babyId, feedPayload);
        }
        try {
          await recalculateReminder(babyId, reminderSettings);
        } catch (error: any) {
          warningText = error?.message ?? 'Feed saved, but reminder could not be updated.';
        }
      }

      if (entryType === 'measurement' && measurementPayload) {
        if (entryId) {
          await updateMeasurement(entryId, measurementPayload);
        } else {
          await addMeasurement(babyId, measurementPayload);
        }
      }

      if (entryType === 'temperature' && temperaturePayload) {
        if (entryId) {
          await updateTemperatureLog(entryId, temperaturePayload);
        } else {
          await addTemperatureLog(babyId, temperaturePayload);
        }
      }

      if (entryType === 'diaper' && diaperPayload) {
        if (entryId) {
          await updateDiaperLog(entryId, diaperPayload);
        } else {
          await addDiaperLog(babyId, diaperPayload);
        }
      }

      if (entryType === 'medication' && medicationPayload) {
        if (entryId) {
          await updateMedicationLog(entryId, medicationPayload);
        } else {
          await addMedicationLog(babyId, medicationPayload);
        }
      }

      if (entryType === 'milestone' && milestonePayload) {
        if (entryId) {
          await updateMilestone(entryId, milestonePayload);
        } else {
          await addMilestone(babyId, milestonePayload);
        }
      }

      bumpDataVersion();
      navigation.goBack();
      void syncNow().catch(() => undefined);

      if (warningText) {
        showToast(warningText, 'info');
      }
    } catch (error: any) {
      showToast(error?.message ?? 'Could not save entry.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {toast ? <ToastBanner kind={toast.kind} message={toast.message} onDismiss={() => setToast(null)} /> : null}
        <Card title="Entry Type">
          <Text style={styles.typeGroupTitle}>Frequent</Text>
          <Row>
            <SelectPill label="Feed" selected={entryType === 'feed'} onPress={() => !isEditing && setEntryType('feed')} />
            <SelectPill
              label="Poop/Pee"
              selected={entryType === 'diaper'}
              onPress={() => !isEditing && setEntryType('diaper')}
            />
          </Row>

          <Text style={styles.typeGroupTitle}>Other</Text>
          <Row>
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

          <Label>Timestamp (default: now)</Label>
          <DateTimePicker
            value={timestamp}
            mode="datetime"
            onChange={(_, d) => {
              if (!d) return;
              setTimestamp(d);
              clearFieldError('timestamp');
            }}
          />
          {fieldErrors.timestamp ? <Text style={styles.errorText}>{fieldErrors.timestamp}</Text> : null}
        </Card>

        {entryType === 'feed' ? (
          <Card title="Feed Details">
            <Label>Feed type</Label>
            <Row>
              {feedTypes.map((option) => (
                <SelectPill
                  key={option}
                  label={option}
                  selected={feedType === option}
                  onPress={() => {
                    setFeedType(option);
                    clearFieldError('feedAmount');
                    clearFieldError('feedDuration');
                    clearFieldError('feedSide');
                  }}
                />
              ))}
            </Row>

            <Label>Amount ({feedAmountUnit})</Label>
            <Input
              value={feedAmount}
              onChangeText={(value) => {
                setFeedAmount(value);
                clearFieldError('feedAmount');
              }}
              keyboardType="decimal-pad"
              placeholder={canHaveAmount ? `Enter ${feedAmountUnit}` : 'Optional'}
              errorText={fieldErrors.feedAmount}
            />

            <Label>Duration (minutes)</Label>
            <Input
              value={feedDuration}
              onChangeText={(value) => {
                setFeedDuration(value);
                clearFieldError('feedDuration');
              }}
              keyboardType="number-pad"
              errorText={fieldErrors.feedDuration}
            />

            <Label>Side</Label>
            <Row>
              {feedSides.map((option) => (
                <SelectPill
                  key={option}
                  label={option}
                  selected={feedSide === option}
                  onPress={() => {
                    setFeedSide(option);
                    clearFieldError('feedSide');
                  }}
                />
              ))}
            </Row>
            {fieldErrors.feedSide ? <Text style={styles.errorText}>{fieldErrors.feedSide}</Text> : null}

            <Label>Notes</Label>
            <Input
              value={feedNotes}
              onChangeText={(value) => {
                setFeedNotes(value);
                clearFieldError('feedNotes');
              }}
              multiline
              style={styles.multiLineInput}
              errorText={fieldErrors.feedNotes}
              maxLength={MAX_NOTES_LENGTH}
            />
          </Card>
        ) : null}

        {entryType === 'measurement' ? (
          <Card title="Measurement Details">
            <Label>Weight ({weightUnit})</Label>
            <Input
              value={weight}
              onChangeText={(value) => {
                setWeight(value);
                clearFieldError('weight');
              }}
              keyboardType="decimal-pad"
              errorText={fieldErrors.weight}
            />

            <Label>Length (cm)</Label>
            <Input
              value={lengthCm}
              onChangeText={(value) => {
                setLengthCm(value);
                clearFieldError('lengthCm');
              }}
              keyboardType="decimal-pad"
              errorText={fieldErrors.lengthCm}
            />

            <Label>Head circumference (cm)</Label>
            <Input
              value={headCm}
              onChangeText={(value) => {
                setHeadCm(value);
                clearFieldError('headCm');
              }}
              keyboardType="decimal-pad"
              errorText={fieldErrors.headCm}
            />

            <Label>Notes</Label>
            <Input
              value={measurementNotes}
              onChangeText={(value) => {
                setMeasurementNotes(value);
                clearFieldError('measurementNotes');
              }}
              multiline
              style={styles.multiLineInput}
              errorText={fieldErrors.measurementNotes}
              maxLength={MAX_NOTES_LENGTH}
            />
          </Card>
        ) : null}

        {entryType === 'temperature' ? (
          <Card title="Temperature Details">
            <Label>Temperature ({tempUnit.toUpperCase()})</Label>
            <Input
              value={temperatureC}
              onChangeText={(value) => {
                setTemperatureC(value);
                clearFieldError('temperature');
              }}
              keyboardType="decimal-pad"
              errorText={fieldErrors.temperature}
            />

            <Label>Notes</Label>
            <Input
              value={temperatureNotes}
              onChangeText={(value) => {
                setTemperatureNotes(value);
                clearFieldError('temperatureNotes');
              }}
              multiline
              style={styles.multiLineInput}
              errorText={fieldErrors.temperatureNotes}
              maxLength={MAX_NOTES_LENGTH}
            />
          </Card>
        ) : null}

        {entryType === 'diaper' ? (
          <Card title="Poop/Pee Details">
            <Row>
              <Text style={styles.label}>Pee</Text>
              <Switch
                value={hadPee}
                onValueChange={(value) => {
                  setHadPee(value);
                  clearFieldError('diaperType');
                }}
              />
            </Row>

            <Row>
              <Text style={styles.label}>Poop</Text>
              <Switch
                value={hadPoop}
                onValueChange={(value) => {
                  setHadPoop(value);
                  clearFieldError('diaperType');
                }}
              />
            </Row>
            {fieldErrors.diaperType ? <Text style={styles.errorText}>{fieldErrors.diaperType}</Text> : null}

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
            <Input
              value={diaperNotes}
              onChangeText={(value) => {
                setDiaperNotes(value);
                clearFieldError('diaperNotes');
              }}
              errorText={fieldErrors.diaperNotes}
              maxLength={MAX_NOTES_LENGTH}
            />
          </Card>
        ) : null}

        {entryType === 'medication' ? (
          <Card title="Medication Details">
            <Label>Medication name</Label>
            <Input
              value={medicationName}
              onChangeText={(value) => {
                setMedicationName(value);
                clearFieldError('medicationName');
              }}
              placeholder="Tylenol"
              errorText={fieldErrors.medicationName}
              maxLength={MAX_NAME_LENGTH}
            />

            <Label>Dose value</Label>
            <Input
              value={doseValue}
              onChangeText={(value) => {
                setDoseValue(value);
                clearFieldError('doseValue');
              }}
              keyboardType="decimal-pad"
              placeholder="2.5"
              errorText={fieldErrors.doseValue}
            />

            <Label>Dose unit</Label>
            <Row>
              {doseUnits.map((unit) => (
                <SelectPill key={unit} label={unit} selected={doseUnit === unit} onPress={() => setDoseUnit(unit)} />
              ))}
            </Row>

            <Label>Minimum spacing (hours)</Label>
            <Input
              value={medIntervalHours}
              onChangeText={(value) => {
                setMedIntervalHours(value);
                clearFieldError('medIntervalHours');
              }}
              keyboardType="decimal-pad"
              placeholder="Optional (e.g. 4)"
              errorText={fieldErrors.medIntervalHours}
            />

            <Label>Notes</Label>
            <Input
              value={medNotes}
              onChangeText={(value) => {
                setMedNotes(value);
                clearFieldError('medNotes');
              }}
              multiline
              style={styles.multiLineInput}
              errorText={fieldErrors.medNotes}
              maxLength={MAX_NOTES_LENGTH}
            />
          </Card>
        ) : null}

        {entryType === 'milestone' ? (
          <Card title="Milestone Details">
            <Label>Title</Label>
            <Input
              value={milestoneTitle}
              onChangeText={(value) => {
                setMilestoneTitle(value);
                clearFieldError('milestoneTitle');
              }}
              placeholder="First smile"
              errorText={fieldErrors.milestoneTitle}
              maxLength={MAX_MILESTONE_TITLE_LENGTH}
            />

            <Label>Notes</Label>
            <Input
              value={milestoneNotes}
              onChangeText={(value) => {
                setMilestoneNotes(value);
                clearFieldError('milestoneNotes');
              }}
              multiline
              style={styles.multiLineInput}
              errorText={fieldErrors.milestoneNotes}
              maxLength={MAX_NOTES_LENGTH}
            />

            <Row>
              <Button title={milestonePhotoUri ? 'Change Photo' : 'Attach Photo'} onPress={pickMilestonePhoto} variant="secondary" />
              {milestonePhotoUri ? (
                <Button
                  title="Remove Photo"
                  onPress={() => {
                    setMilestonePhotoUri(null);
                    clearFieldError('milestonePhoto');
                  }}
                  variant="danger"
                />
              ) : null}
            </Row>
            {fieldErrors.milestonePhoto ? <Text style={styles.errorText}>{fieldErrors.milestonePhoto}</Text> : null}
            {milestonePhotoUri ? <Image source={{ uri: milestonePhotoUri }} style={styles.photoPreview} /> : null}
          </Card>
        ) : null}

        <Button title={busy ? 'Saving...' : isEditing ? 'Update Entry' : 'Save Entry'} onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing[4], gap: theme.spacing[2] },
    label: {
      ...theme.typography.bodySm,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    hint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: theme.spacing[2],
    },
    errorText: {
      ...theme.typography.caption,
      color: theme.colors.error,
      marginTop: theme.spacing[1],
    },
    typeGroupTitle: {
      ...theme.typography.overline,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      marginTop: theme.spacing[1],
      marginBottom: theme.spacing[1],
    },
    multiLineInput: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
    photoPreview: {
      width: '100%',
      height: 180,
      borderRadius: theme.radius.md,
      marginTop: theme.spacing[2],
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
  });
