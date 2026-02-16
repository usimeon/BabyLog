import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
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
        Alert.alert(
          'Supabase not configured',
          'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
        );
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
          <Card title={mode === 'signIn' ? 'Welcome Back' : 'Create Your Account'}>
            <Row>
              <SelectPill label="Sign In" selected={mode === 'signIn'} onPress={() => setMode('signIn')} />
              <SelectPill label="Create Account" selected={mode === 'signUp'} onPress={() => setMode('signUp')} />
            </Row>

            <Label>Email</Label>
            <Input
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="parent@email.com"
            />

            <Label>Password</Label>
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="At least 6 characters"
            />

            <Button title={busy ? 'Please wait...' : mode === 'signIn' ? 'Sign In' : 'Create Account'} onPress={submit} />
            <Text style={styles.helper}>Cloud is optional. App works fully offline without signing in.</Text>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef3fb' },
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, flexGrow: 1, justifyContent: 'center' },
  helper: { marginTop: 10, fontSize: 12, color: '#64748b' },
});
