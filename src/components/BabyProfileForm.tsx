import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Input, Label } from './ui';

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
  return (
    <View style={styles.container}>
      <Label>Baby name</Label>
      <Input
        value={babyName}
        onChangeText={onBabyNameChange}
        placeholder="Baby name"
        autoCapitalize="words"
        style={compact ? styles.compactInput : undefined}
      />

      <Label>Baby birthdate</Label>
      <View style={styles.dateWrap}>
        <DateTimePicker
          value={babyBirthdate}
          mode="date"
          display={Platform.OS === 'ios' ? 'compact' : 'default'}
          onChange={(_, d) => d && onBabyBirthdateChange(d)}
        />
      </View>
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  compactInput: { height: 48 },
  dateWrap: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});

