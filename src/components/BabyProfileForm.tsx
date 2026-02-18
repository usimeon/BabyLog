import React, { useMemo, useState } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent, Platform, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Input } from './ui';
import { getTheme } from '../theme/designSystem';

type BabyProfileFormProps = {
  babyName: string;
  onBabyNameChange: (value: string) => void;
  babyBirthdate: Date;
  onBabyBirthdateChange: (value: Date) => void;
  compact?: boolean;
  errorText?: string | null;
};

export const BabyProfileForm = ({
  babyName,
  onBabyNameChange,
  babyBirthdate,
  onBabyBirthdateChange,
  compact = false,
  errorText = null,
}: BabyProfileFormProps) => {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === 'dark' ? 'dark' : 'light');
  const [activeStep, setActiveStep] = useState(0);
  const [trackingFocus, setTrackingFocus] = useState<'feeds' | 'growth' | 'care'>('feeds');

  const stepHeight = compact ? 228 : 258;
  const stepGap = compact ? 10 : 12;
  const snapInterval = stepHeight + stepGap;

  const focusOptions = useMemo(
    () => [
      {
        id: 'feeds' as const,
        title: 'Feeds',
        detail: 'Breast, bottle, formula, and solids logs',
      },
      {
        id: 'growth' as const,
        title: 'Growth',
        detail: 'Weight, length, and head circumference tracking',
      },
      {
        id: 'care' as const,
        title: 'Care',
        detail: 'Temperature, diaper, medication, and milestones',
      },
    ],
    [],
  );

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / snapInterval);
    const next = Math.max(0, Math.min(2, index));
    if (next !== activeStep) setActiveStep(next);
  };

  const cardStyle = (index: number) => ({
    borderColor: index === activeStep ? theme.colors.primary : theme.colors.border,
    backgroundColor: index === activeStep ? theme.colors.surface : theme.colors.neutral100,
    opacity: index === activeStep ? 1 : 0.58,
  });

  return (
    <View style={styles.container}>
      <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>
        Swipe up or down. The step in view stays in focus.
      </Text>

      <View style={styles.progressRow}>
        {[0, 1, 2].map((step) => (
          <View
            key={step}
            style={[
              styles.progressDot,
              {
                backgroundColor: step === activeStep ? theme.colors.primary : theme.colors.border,
              },
            ]}
          />
        ))}
      </View>

      <View style={[styles.stepViewport, { height: stepHeight }]}>
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={snapInterval}
          decelerationRate="fast"
          disableIntervalMomentum
          scrollEventThrottle={16}
          onScroll={onScroll}
          contentContainerStyle={{ rowGap: stepGap }}
        >
          <View
            style={[
              styles.stepCard,
              { minHeight: stepHeight },
              cardStyle(0),
            ]}
          >
            <Text style={[styles.stepTitle, { color: theme.colors.textPrimary }]}>What is your baby called?</Text>
            <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
              Name appears in logs, charts, and reminders.
            </Text>
            <Input
              value={babyName}
              onChangeText={onBabyNameChange}
              placeholder="e.g. Ava"
              autoCapitalize="words"
              style={[styles.input, compact ? styles.compactInput : undefined]}
            />
          </View>

          <View
            style={[
              styles.stepCard,
              { minHeight: stepHeight },
              cardStyle(1),
            ]}
          >
            <Text style={[styles.stepTitle, { color: theme.colors.textPrimary }]}>When was your baby born?</Text>
            <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
              Used for age-aware suggestions and growth charts.
            </Text>
            <View style={[styles.dateWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <DateTimePicker
                value={babyBirthdate}
                mode="date"
                display={Platform.OS === 'ios' ? 'compact' : 'default'}
                maximumDate={new Date()}
                onChange={(_, d) => d && onBabyBirthdateChange(d)}
              />
            </View>
          </View>

          <View
            style={[
              styles.stepCard,
              { minHeight: stepHeight },
              cardStyle(2),
            ]}
          >
            <Text style={[styles.stepTitle, { color: theme.colors.textPrimary }]}>What do you want to track first?</Text>
            <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
              Pick one BabyLog area to start with.
            </Text>
            <View style={styles.optionList}>
              {focusOptions.map((option) => {
                const selected = trackingFocus === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setTrackingFocus(option.id)}
                    style={[
                      styles.optionCard,
                      {
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                        backgroundColor: selected ? `${theme.colors.primary}18` : theme.colors.surface,
                      },
                    ]}
                  >
                    <Text style={[styles.optionTitle, { color: theme.colors.textPrimary }]}>{option.title}</Text>
                    <Text style={[styles.optionDetail, { color: theme.colors.textSecondary }]}>{option.detail}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>

      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  helper: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressDot: {
    width: 26,
    height: 4,
    borderRadius: 999,
  },
  stepViewport: {
    overflow: 'hidden',
  },
  stepCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
  },
  stepTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  input: {
    marginTop: 2,
  },
  compactInput: {
    height: 48,
  },
  dateWrap: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  optionList: {
    gap: 8,
  },
  optionCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionTitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: 0,
  },
  optionDetail: {
    marginTop: 1,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
