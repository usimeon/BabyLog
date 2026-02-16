import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { signInWithEmail, signUpWithEmail } from '../supabase/auth';
import { isSupabaseConfigured } from '../supabase/client';
import { useAppContext } from '../context/AppContext';
import { Button, Card, Input, Label, Row, SelectPill } from '../components/ui';

export const AuthScreen = () => {
  const { refreshSession } = useAppContext();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    try {
      setBusy(true);
      if (!isSupabaseConfigured) {
        Alert.alert('Supabase not configured', 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
        return;
      }

      if (mode === 'signIn') {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password);
        Alert.alert('Account created', 'Sign in with your credentials.');
        setMode('signIn');
      }
      await refreshSession();
    } catch (error: any) {
      Alert.alert('Auth failed', error?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>BabyLog</Text>
          <Text style={styles.subtitle}>Sign in to enable cloud backup and sync.</Text>

          <Card>
            <Row>
              <SelectPill label="Sign In" selected={mode === 'signIn'} onPress={() => setMode('signIn')} />
              <SelectPill label="Create Account" selected={mode === 'signUp'} onPress={() => setMode('signUp')} />
            </Row>

            <Label>Email</Label>
            <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

            <Label>Password</Label>
            <Input value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />

            <Button title={busy ? 'Please wait...' : mode === 'signIn' ? 'Sign In' : 'Create Account'} onPress={submit} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  flex: { flex: 1 },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#475569' },
});
