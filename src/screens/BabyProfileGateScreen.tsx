import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../app/navigation';
import { Button, Input, Label } from '../components/ui';
import { ToastBanner, ToastBannerKind } from '../components/ToastBanner';
import { useAppContext } from '../context/AppContext';
import { isBabyNameTaken } from '../db/babyRepo';
import { addMeasurement, getInitialOnboardingMeasurementByBabyId, updateMeasurement } from '../db/measurementRepo';
import { setBabySex } from '../db/settingsRepo';
import { MAX_BABY_AGE_YEARS, validateBabyProfile } from '../services/babyProfileValidation';
import { getTheme } from '../theme/designSystem';
import { displayToKg } from '../utils/units';

type BabySex = 'boy' | 'girl';
type OnboardingField = 'babyName' | 'birthWeight' | 'birthLengthCm' | 'birthHeadCm' | 'babyPhoto';

type ToastState = {
  kind: ToastBannerKind;
  message: string;
} | null;

const NEXT_STEP_LABELS = ['Continue', 'Keep Going', 'Tell Me More'] as const;

const sexOptions: Array<{ id: BabySex; emoji: string; label: string }> = [
  { id: 'boy', emoji: '👶🏻', label: 'Boy' },
  { id: 'girl', emoji: '👧🏻', label: 'Girl' },
];
const MAX_BABY_NAME_LENGTH = 120;
const MAX_PHOTO_URI_LENGTH = 2000;

export const BabyProfileGateScreen = ({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'BabyOnboarding'>) => {
  const {
    amountUnit,
    babyId,
    createNewBabyProfile,
    hasRequiredBabyProfile,
    saveRequiredBabyProfile,
    refreshAppState,
    syncNow,
    tempUnit,
    updateAmountUnit,
    updateTempUnit,
    updateWeightUnit,
    weightUnit,
  } = useAppContext();

  const scheme = useColorScheme();
  const theme = getTheme(scheme === 'dark' ? 'dark' : 'light');
  const { height } = useWindowDimensions();
  const stepsRef = useRef<ScrollView | null>(null);

  const [babyName, setBabyName] = useState('');
  const [babyBirthdate, setBabyBirthdate] = useState(new Date());
  const [babyPhotoUri, setBabyPhotoUri] = useState<string | null>(null);
  const [selectedSex, setSelectedSex] = useState<BabySex | null>(null);
  const [selectedAmountUnit, setSelectedAmountUnit] = useState<'ml' | 'oz'>(amountUnit);
  const [selectedWeightUnit, setSelectedWeightUnit] = useState<'kg' | 'lb'>(weightUnit);
  const [selectedTempUnit, setSelectedTempUnit] = useState<'c' | 'f'>(tempUnit);
  const [birthWeight, setBirthWeight] = useState('');
  const [birthLengthCm, setBirthLengthCm] = useState('');
  const [birthHeadCm, setBirthHeadCm] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<OnboardingField, string>>>({});

  const isCreateMode = navigation.canGoBack();
  const showTrackingUnitsStep = !isCreateMode && !hasRequiredBabyProfile;

  const sexStepIndex = 1;
  const birthdateStepIndex = 2;
  const trackingStepIndex = 3;
  const measurementsStepIndex = showTrackingUnitsStep ? 4 : 3;
  const totalSteps = measurementsStepIndex + 1;

  const minBirthdate = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - MAX_BABY_AGE_YEARS);
    return d;
  }, []);

  const stepHeight = Math.max(320, Math.min(520, height - 280));
  const isLastStep = activeStep === totalSteps - 1;
  const canSkipMeasurements = activeStep === measurementsStepIndex && !busy;
  const primaryActionLabel = busy
    ? 'Saving...'
    : isLastStep
      ? isCreateMode
        ? 'Create Profile'
        : 'Off We Go!'
      : NEXT_STEP_LABELS[activeStep % NEXT_STEP_LABELS.length];

  const showToast = (message: string, kind: ToastBannerKind = 'info') => {
    setToast({ kind, message });
  };

  const clearFieldError = (field: OnboardingField) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  const snapToStep = (index: number) => {
    const safeIndex = Math.max(0, Math.min(totalSteps - 1, index));
    stepsRef.current?.scrollTo({ y: safeIndex * stepHeight, animated: true });
    setActiveStep(safeIndex);
  };

  const onStepScrollComplete = (offsetY: number) => {
    const index = Math.round(offsetY / stepHeight);
    setActiveStep(Math.max(0, Math.min(totalSteps - 1, index)));
  };

  const pickBabyPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Photo library permission is needed to add a baby picture.', 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets.length > 0) {
      setBabyPhotoUri(result.assets[0].uri);
      clearFieldError('babyPhoto');
    }
  };

  const getMeasurementPayload = () => {
    const trimmedWeight = birthWeight.trim();
    const trimmedLength = birthLengthCm.trim();
    const trimmedHead = birthHeadCm.trim();

    if (!trimmedWeight) {
      return {
        weightKg: null as number | null,
        lengthCm: null as number | null,
        headCircumferenceCm: null as number | null,
        error: null as string | null,
        field: null as OnboardingField | null,
      };
    }

    const parsedWeight = Number(trimmedWeight);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      return {
        weightKg: null,
        lengthCm: null,
        headCircumferenceCm: null,
        error: `Enter a valid weight in ${selectedWeightUnit}.`,
        field: 'birthWeight' as OnboardingField,
      };
    }

    const parsedLength = trimmedLength ? Number(trimmedLength) : null;
    if (parsedLength !== null && (!Number.isFinite(parsedLength) || parsedLength <= 0)) {
      return {
        weightKg: null,
        lengthCm: null,
        headCircumferenceCm: null,
        error: 'Enter a valid length in cm.',
        field: 'birthLengthCm' as OnboardingField,
      };
    }

    const parsedHead = trimmedHead ? Number(trimmedHead) : null;
    if (parsedHead !== null && (!Number.isFinite(parsedHead) || parsedHead <= 0)) {
      return {
        weightKg: null,
        lengthCm: null,
        headCircumferenceCm: null,
        error: 'Enter a valid head circumference in cm.',
        field: 'birthHeadCm' as OnboardingField,
      };
    }

    return {
      weightKg: displayToKg(parsedWeight, selectedWeightUnit),
      lengthCm: parsedLength,
      headCircumferenceCm: parsedHead,
      error: null,
      field: null,
    };
  };

  const validateCurrentStep = () => {
    if (activeStep === 0) {
      const trimmedName = babyName.trim();
      if (!trimmedName) return { error: 'Baby name is required.', field: 'babyName' as OnboardingField };
      if (trimmedName.length > MAX_BABY_NAME_LENGTH) {
        return {
          error: `Baby name must be ${MAX_BABY_NAME_LENGTH} characters or fewer.`,
          field: 'babyName' as OnboardingField,
        };
      }
      if (babyPhotoUri && babyPhotoUri.trim().length > MAX_PHOTO_URI_LENGTH) {
        return {
          error: 'Baby photo reference is too long. Choose a different photo.',
          field: 'babyPhoto' as OnboardingField,
        };
      }
    }

    if (activeStep === sexStepIndex && !selectedSex) return { error: 'Select baby sex to continue.', field: null };

    if (activeStep === birthdateStepIndex) {
      const validationError = validateBabyProfile(babyName.trim() || 'Baby', babyBirthdate);
      if (validationError) return { error: validationError, field: null };
    }

    return null as { error: string; field: OnboardingField | null } | null;
  };

  const submit = async (options?: { skipMeasurements?: boolean }) => {
    if (busy) return;

    setFieldErrors({});
    const stepError = validateCurrentStep();
    if (stepError) {
      if (stepError.field) {
        setFieldErrors({ [stepError.field]: stepError.error });
      }
      setErrorText(stepError.error);
      return;
    }

    if (!isLastStep) {
      setErrorText(null);
      snapToStep(activeStep + 1);
      return;
    }

    const validationError = validateBabyProfile(babyName.trim(), babyBirthdate);
    if (validationError) {
      if (!babyName.trim()) snapToStep(0);
      else snapToStep(birthdateStepIndex);
      setErrorText(validationError);
      return;
    }

    if (!selectedSex) {
      snapToStep(sexStepIndex);
      setErrorText('Select baby sex to continue.');
      return;
    }

    const trimmedName = babyName.trim();
    if (trimmedName.length > MAX_BABY_NAME_LENGTH) {
      snapToStep(0);
      setFieldErrors({ babyName: `Baby name must be ${MAX_BABY_NAME_LENGTH} characters or fewer.` });
      setErrorText(`Baby name must be ${MAX_BABY_NAME_LENGTH} characters or fewer.`);
      return;
    }
    if (babyPhotoUri && babyPhotoUri.trim().length > MAX_PHOTO_URI_LENGTH) {
      snapToStep(0);
      setFieldErrors({ babyPhoto: 'Baby photo reference is too long. Choose a different photo.' });
      setErrorText('Baby photo reference is too long. Choose a different photo.');
      return;
    }

    const duplicateName = await isBabyNameTaken(trimmedName, isCreateMode ? undefined : { excludeBabyId: babyId });
    if (duplicateName) {
      snapToStep(0);
      setFieldErrors({ babyName: 'Baby name already exists. Use a different name.' });
      setErrorText('Baby name already exists. Use a different name.');
      return;
    }

    const measurement = options?.skipMeasurements
      ? {
          weightKg: null as number | null,
          lengthCm: null as number | null,
          headCircumferenceCm: null as number | null,
          error: null as string | null,
          field: null as OnboardingField | null,
        }
      : getMeasurementPayload();
    if (measurement.error) {
      snapToStep(measurementsStepIndex);
      if (measurement.field) {
        setFieldErrors({ [measurement.field]: measurement.error });
      }
      setErrorText(measurement.error);
      return;
    }

    try {
      setBusy(true);
      setErrorText(null);

      await Promise.all([
        updateAmountUnit(selectedAmountUnit),
        updateWeightUnit(selectedWeightUnit),
        updateTempUnit(selectedTempUnit),
        setBabySex(selectedSex),
      ]);

      const targetBabyId = isCreateMode
        ? await createNewBabyProfile(trimmedName, babyBirthdate, babyPhotoUri)
        : await saveRequiredBabyProfile(trimmedName, babyBirthdate, babyPhotoUri);

      if (targetBabyId && measurement.weightKg !== null) {
        try {
          const birthTimestamp = new Date(
            Date.UTC(
              babyBirthdate.getFullYear(),
              babyBirthdate.getMonth(),
              babyBirthdate.getDate(),
              12,
              0,
              0,
              0,
            ),
          ).toISOString();

          const payload = {
            timestamp: birthTimestamp,
            weight_kg: measurement.weightKg,
            length_cm: measurement.lengthCm,
            head_circumference_cm: measurement.headCircumferenceCm,
            notes: 'Initial onboarding measurement',
          };

          const existingInitial = await getInitialOnboardingMeasurementByBabyId(targetBabyId);
          if (existingInitial) {
            await updateMeasurement(existingInitial.id, payload);
          } else {
            await addMeasurement(targetBabyId, payload);
          }
        } catch (measurementError: any) {
          showToast(`Profile saved. Birth measurement was skipped: ${measurementError?.message ?? 'Invalid values.'}`, 'info');
        }
      }

      void syncNow();
      if (isCreateMode && navigation.canGoBack()) {
        navigation.goBack();
      } else if (!isCreateMode) {
        await refreshAppState();
      }
    } catch (error: any) {
      setErrorText(error?.message ?? 'Profile update failed.');
    } finally {
      setBusy(false);
    }
  };

  const goPrevious = () => {
    if (busy || activeStep === 0) return;
    setErrorText(null);
    snapToStep(activeStep - 1);
  };

  useEffect(() => {
    setActiveStep((prev) => Math.max(0, Math.min(totalSteps - 1, prev)));
  }, [totalSteps]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isCreateMode ? theme.colors.surface : theme.colors.background }]}> 
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.content}>
          <View style={styles.topBar}>
            {navigation.canGoBack() ? (
              <Pressable style={[styles.backButton, { backgroundColor: theme.colors.surface }]} onPress={() => navigation.goBack()} hitSlop={10}>
                <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
              </Pressable>
            ) : (
              <View style={styles.backPlaceholder} />
            )}

            {canSkipMeasurements ? (
              <Pressable
                style={[styles.skipButton, { backgroundColor: theme.colors.surface }]}
                onPress={async () => {
                  setBirthWeight('');
                  setBirthLengthCm('');
                  setBirthHeadCm('');
                  setErrorText(null);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.birthWeight;
                    delete next.birthLengthCm;
                    delete next.birthHeadCm;
                    return next;
                  });
                  if (isLastStep) {
                    await submit({ skipMeasurements: true });
                  } else {
                    snapToStep(activeStep + 1);
                  }
                }}
                hitSlop={10}
              >
                <Text style={[styles.skipButtonText, { color: theme.colors.textPrimary }]}>Skip</Text>
              </Pressable>
            ) : (
              <View style={styles.skipPlaceholder} />
            )}
          </View>

          {toast ? <ToastBanner kind={toast.kind} message={toast.message} onDismiss={() => setToast(null)} /> : null}

          {!isCreateMode ? (
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Set up your baby profile</Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>One step is in focus. Scroll up or down to move to the next or previous step.</Text>
            </View>
          ) : null}

          <ScrollView
            ref={stepsRef}
            style={styles.stepsViewport}
            contentContainerStyle={styles.stepsContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            snapToInterval={stepHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
            onMomentumScrollEnd={(event) => onStepScrollComplete(event.nativeEvent.contentOffset.y)}
            onScrollEndDrag={(event) => onStepScrollComplete(event.nativeEvent.contentOffset.y)}
          >
            <View style={[styles.stepSlide, { height: stepHeight }]}> 
              <View
                style={[
                  styles.stepCard,
                  { borderColor: theme.colors.border, borderWidth: isCreateMode ? 0 : 1, backgroundColor: theme.colors.surface },
                  activeStep !== 0 && styles.inactiveStep,
                ]}
              >
                <Text style={[styles.stepTitle, { color: theme.colors.textPrimary }]}>What should we call your baby?</Text>
                <Label>Baby name</Label>
                <Input
                  value={babyName}
                  onChangeText={(value) => {
                    setBabyName(value);
                    clearFieldError('babyName');
                    if (errorText) setErrorText(null);
                  }}
                  placeholder="e.g. Ava"
                  autoCapitalize="words"
                  returnKeyType="done"
                  errorText={fieldErrors.babyName}
                  maxLength={MAX_BABY_NAME_LENGTH}
                />

                <Label>Photo (optional)</Label>
                <View style={styles.photoRow}>
                  <View style={[styles.photoPreview, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }]}> 
                    {babyPhotoUri ? (
                      <Image source={{ uri: babyPhotoUri }} style={styles.photoPreviewImage} />
                    ) : (
                      <Ionicons name="person" size={20} color={theme.colors.textMuted} />
                    )}
                  </View>
                  <View style={styles.photoActions}>
                    <Button title={babyPhotoUri ? 'Change photo' : 'Add photo'} size="sm" variant="secondary" onPress={pickBabyPhoto} />
                    {babyPhotoUri ? (
                      <Button
                        title="Remove"
                        size="sm"
                        variant="outline"
                        onPress={() => {
                          setBabyPhotoUri(null);
                          clearFieldError('babyPhoto');
                        }}
                      />
                    ) : null}
                  </View>
                </View>
                {fieldErrors.babyPhoto ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{fieldErrors.babyPhoto}</Text> : null}
              </View>
            </View>

            <View style={[styles.stepSlide, { height: stepHeight }]}> 
              <View
                style={[
                  styles.stepCard,
                  { borderColor: theme.colors.border, borderWidth: isCreateMode ? 0 : 1, backgroundColor: theme.colors.surface },
                  activeStep !== sexStepIndex && styles.inactiveStep,
                ]}
              >
                <Text style={[styles.stepTitle, { color: theme.colors.textPrimary }]}>What is your baby's sex?</Text>
                <Text style={[styles.stepDetail, { color: theme.colors.textSecondary }]}>Used to personalize growth context.</Text>
                <View style={styles.sexRow}>
                  {sexOptions.map((option) => {
                    const selected = selectedSex === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => {
                          setSelectedSex(option.id);
                          if (errorText) setErrorText(null);
                        }}
                        style={[
                          styles.goalItem,
                          styles.sexOptionItem,
                          {
                            borderColor: selected ? theme.colors.primary : theme.colors.border,
                            borderWidth: isCreateMode ? 0 : 1,
                            backgroundColor: selected ? `${theme.colors.primary}14` : theme.colors.surface,
                          },
                        ]}
                      >
                        <Text style={styles.goalEmoji}>{option.emoji}</Text>
                        <Text style={[styles.goalTitle, { color: theme.colors.textPrimary }]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={[styles.stepSlide, { height: stepHeight }]}> 
              <View
                style={[
                  styles.stepCard,
                  { borderColor: theme.colors.border, borderWidth: isCreateMode ? 0 : 1, backgroundColor: theme.colors.surface },
                  activeStep !== birthdateStepIndex && styles.inactiveStep,
                ]}
              >
                <Text style={[styles.stepTitle, { color: theme.colors.textPrimary }]}>When was your baby born?</Text>
                <Text style={[styles.stepDetail, { color: theme.colors.textSecondary }]}>We use this for age-aware insights and growth charts.</Text>
                <View
                  style={[
                    styles.dateWrap,
                    {
                      borderColor: theme.colors.border,
                      borderWidth: isCreateMode ? 0 : 1,
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                >
                  <DateTimePicker
                    value={babyBirthdate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    maximumDate={new Date()}
                    minimumDate={minBirthdate}
                    onChange={(_, date) => {
                      if (!date) return;
                      setBabyBirthdate(date);
                      if (errorText) setErrorText(null);
                    }}
                  />
                </View>
              </View>
            </View>

            {showTrackingUnitsStep ? (
              <View style={[styles.stepSlide, { height: stepHeight }]}> 
                <View
                  style={[
                    styles.stepCard,
                    { borderColor: theme.colors.border, borderWidth: isCreateMode ? 0 : 1, backgroundColor: theme.colors.surface },
                    activeStep !== trackingStepIndex && styles.inactiveStep,
                  ]}
                >
                  <Text style={[styles.stepTitle, { color: theme.colors.textPrimary }]}>Pick your tracking units</Text>
                  <Text style={[styles.stepDetail, { color: theme.colors.textSecondary }]}>You can always change these later.</Text>

                  <Text style={[styles.groupLabel, { color: theme.colors.textSecondary }]}>Milk</Text>
                  <View style={styles.choiceRow}>
                    {(['ml', 'oz'] as const).map((unit) => {
                      const selected = selectedAmountUnit === unit;
                      return (
                        <Pressable
                          key={unit}
                          onPress={() => setSelectedAmountUnit(unit)}
                          style={[
                            styles.choice,
                            {
                              borderColor: selected ? theme.colors.primary : theme.colors.border,
                              borderWidth: isCreateMode ? 0 : 1,
                              backgroundColor: selected ? `${theme.colors.primary}14` : theme.colors.surface,
                            },
                          ]}
                        >
                          <Text style={[styles.choiceText, { color: selected ? theme.colors.primary : theme.colors.textPrimary }]}>{unit.toUpperCase()}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={[styles.groupLabel, { color: theme.colors.textSecondary }]}>Weight</Text>
                  <View style={styles.choiceRow}>
                    {(['kg', 'lb'] as const).map((unit) => {
                      const selected = selectedWeightUnit === unit;
                      return (
                        <Pressable
                          key={unit}
                          onPress={() => setSelectedWeightUnit(unit)}
                          style={[
                            styles.choice,
                            {
                              borderColor: selected ? theme.colors.primary : theme.colors.border,
                              borderWidth: isCreateMode ? 0 : 1,
                              backgroundColor: selected ? `${theme.colors.primary}14` : theme.colors.surface,
                            },
                          ]}
                        >
                          <Text style={[styles.choiceText, { color: selected ? theme.colors.primary : theme.colors.textPrimary }]}>{unit.toUpperCase()}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={[styles.groupLabel, { color: theme.colors.textSecondary }]}>Temperature</Text>
                  <View style={styles.choiceRow}>
                    {(['c', 'f'] as const).map((unit) => {
                      const selected = selectedTempUnit === unit;
                      return (
                        <Pressable
                          key={unit}
                          onPress={() => setSelectedTempUnit(unit)}
                          style={[
                            styles.choice,
                            {
                              borderColor: selected ? theme.colors.primary : theme.colors.border,
                              borderWidth: isCreateMode ? 0 : 1,
                              backgroundColor: selected ? `${theme.colors.primary}14` : theme.colors.surface,
                            },
                          ]}
                        >
                          <Text style={[styles.choiceText, { color: selected ? theme.colors.primary : theme.colors.textPrimary }]}>{unit.toUpperCase()}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            ) : null}

            <View style={[styles.stepSlide, { height: stepHeight }]}> 
              <View
                style={[
                  styles.stepCard,
                  { borderColor: theme.colors.border, borderWidth: isCreateMode ? 0 : 1, backgroundColor: theme.colors.surface },
                  activeStep !== measurementsStepIndex && styles.inactiveStep,
                ]}
              >
                <Text style={[styles.stepTitle, { color: theme.colors.textPrimary }]}>Add birth measurements</Text>
                <Text style={[styles.stepDetail, { color: theme.colors.textSecondary }]}>Optional. Add now or skip.</Text>

                <View style={styles.measurementRow}>
                  <Text style={[styles.measurementLabel, { color: theme.colors.textSecondary }]}>Weight ({selectedWeightUnit})</Text>
                  <Input
                    value={birthWeight}
                    onChangeText={(value) => {
                      setBirthWeight(value);
                      clearFieldError('birthWeight');
                      if (errorText) setErrorText(null);
                    }}
                    placeholder={selectedWeightUnit === 'kg' ? 'e.g. 3.4' : 'e.g. 7.5'}
                    keyboardType="decimal-pad"
                    style={styles.measurementInput}
                    errorText={fieldErrors.birthWeight}
                  />
                </View>

                <View style={styles.measurementRow}>
                  <Text style={[styles.measurementLabel, { color: theme.colors.textSecondary }]}>Length (cm)</Text>
                  <Input
                    value={birthLengthCm}
                    onChangeText={(value) => {
                      setBirthLengthCm(value);
                      clearFieldError('birthLengthCm');
                      if (errorText) setErrorText(null);
                    }}
                    placeholder="e.g. 51"
                    keyboardType="decimal-pad"
                    style={styles.measurementInput}
                    errorText={fieldErrors.birthLengthCm}
                  />
                </View>

                <View style={styles.measurementRow}>
                  <Text style={[styles.measurementLabel, { color: theme.colors.textSecondary }]}>Head (cm)</Text>
                  <Input
                    value={birthHeadCm}
                    onChangeText={(value) => {
                      setBirthHeadCm(value);
                      clearFieldError('birthHeadCm');
                      if (errorText) setErrorText(null);
                    }}
                    placeholder="e.g. 34"
                    keyboardType="decimal-pad"
                    style={styles.measurementInput}
                    errorText={fieldErrors.birthHeadCm}
                  />
                </View>
              </View>
            </View>
          </ScrollView>

          {errorText ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{errorText}</Text> : null}

          <View style={styles.footer}>
            <View style={styles.progressRow}>
              {Array.from({ length: totalSteps }).map((_, step) => (
                <View key={step} style={[styles.progressDot, { backgroundColor: step === activeStep ? theme.colors.primary : theme.colors.border }]} />
              ))}
            </View>

            <View style={styles.buttonRow}>
              <Pressable
                onPress={goPrevious}
                disabled={busy || activeStep === 0}
                style={[styles.previousButton, { backgroundColor: theme.colors.surface }, (busy || activeStep === 0) && styles.previousButtonDisabled]}
              >
                <Text style={[styles.previousButtonText, { color: theme.colors.textPrimary }]}>Previous</Text>
              </Pressable>
              <View style={styles.primaryActionWrap}>
                <Button title={primaryActionLabel} onPress={submit} />
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  topBar: {
    minHeight: 48,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: {
    width: 44,
    height: 44,
  },
  skipButton: {
    minHeight: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  skipButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  skipPlaceholder: {
    width: 56,
    height: 38,
  },
  header: { paddingTop: 10, paddingBottom: 8, gap: 6 },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
  subtitle: { fontSize: 14, lineHeight: 20 },
  stepsViewport: { flex: 1 },
  stepsContent: { paddingVertical: 8 },
  stepSlide: { justifyContent: 'center', paddingVertical: 8 },
  stepCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 10,
  },
  inactiveStep: {
    opacity: 0.52,
    transform: [{ scale: 0.985 }],
  },
  stepTitle: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  stepDetail: { fontSize: 14, lineHeight: 20 },
  dateWrap: {
    borderWidth: 1,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 10,
    minHeight: 52,
  },
  groupLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  choice: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 46,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  sexRow: {
    flexDirection: 'row',
    gap: 8,
  },
  measurementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  measurementLabel: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  measurementInput: {
    width: 132,
    textAlign: 'right',
  },
  goalItem: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 66,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sexOptionItem: {
    flex: 1,
    minHeight: 56,
  },
  goalEmoji: {
    fontSize: 24,
  },
  goalTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  photoPreview: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  footer: { paddingTop: 10 },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  buttonRow: {
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previousButton: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previousButtonDisabled: {
    opacity: 0.45,
  },
  previousButtonText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  primaryActionWrap: {
    flex: 1,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    paddingTop: 8,
  },
});
