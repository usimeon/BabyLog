import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BabyProfileForm } from '../components/BabyProfileForm';
import { Button, Card } from '../components/ui';
import { useAppContext } from '../context/AppContext';
import { validateBabyProfile } from '../services/babyProfileValidation';

export const BabyProfileGateScreen = () => {
  const { saveRequiredBabyProfile, syncNow } = useAppContext();
  const [babyName, setBabyName] = useState('');
  const [babyBirthdate, setBabyBirthdate] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const submit = async () => {
    const validationError = validateBabyProfile(babyName, babyBirthdate);
    if (validationError) {
      setErrorText(validationError);
      return;
    }

    try {
      setBusy(true);
      setErrorText(null);
      await saveRequiredBabyProfile(babyName, babyBirthdate);
      await syncNow();
    } catch (error: any) {
      Alert.alert('Profile update failed', error?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card title="Complete Baby Profile">
            <Text style={styles.subtitle}>
              We need your baby details to personalize milestones, age-based insights, and growth charts.
            </Text>
            <BabyProfileForm
              babyName={babyName}
              onBabyNameChange={setBabyName}
              babyBirthdate={babyBirthdate}
              onBabyBirthdateChange={setBabyBirthdate}
              errorText={errorText}
            />
            <View style={styles.buttonWrap}>
              <Button title={busy ? 'Saving...' : 'Continue'} onPress={submit} />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  subtitle: { marginBottom: 12, color: '#475569', fontSize: 15, lineHeight: 22 },
  buttonWrap: { marginTop: 12 },
});

