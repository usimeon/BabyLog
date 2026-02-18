import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Image,
  useColorScheme,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmail, signInWithGoogleOAuth, signUpWithEmail } from '../supabase/auth';
import { isSupabaseConfigured } from '../supabase/client';
import { useAppContext } from '../context/AppContext';
import { getOrCreateDefaultBaby, upsertBaby } from '../db/babyRepo';
import { nowIso } from '../utils/time';
import { getTheme } from '../theme/designSystem';
import { validateBabyProfile } from '../services/babyProfileValidation';
import { BabyProfileForm } from '../components/BabyProfileForm';

const toUtcNoonIso = (value: Date) => {
  const utc = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0));
  return utc.toISOString();
};

export const AuthScreen = () => {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === 'dark' ? 'dark' : 'light');
  const { refreshSession, refreshAppState } = useAppContext();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [babyName, setBabyName] = useState('');
  const [babyBirthdate, setBabyBirthdate] = useState<Date>(new Date());
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [babyProfileError, setBabyProfileError] = useState<string | null>(null);
  const isSignUp = mode === 'signUp';

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

      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        Alert.alert('Missing email', 'Email is required.');
        return;
      }

      if (!password) {
        Alert.alert('Missing password', 'Password is required.');
        return;
      }

      if (password.length < 6) {
        Alert.alert('Weak password', 'Password must be at least 6 characters.');
        return;
      }

      if (mode === 'signIn') {
        await signInWithEmail(trimmedEmail, password);
      } else {
        const validationError = validateBabyProfile(babyName, babyBirthdate);
        if (validationError) {
          setBabyProfileError(validationError);
          return;
        }
        if (password !== confirmPassword) {
          Alert.alert('Password mismatch', 'Confirm password must match.');
          return;
        }
        await signUpWithEmail(trimmedEmail, password);
        const existingBaby = await getOrCreateDefaultBaby();
        await upsertBaby(
          {
            ...existingBaby,
            name: babyName.trim(),
            birthdate: toUtcNoonIso(babyBirthdate),
            updated_at: nowIso(),
          },
          true,
        );
        await refreshAppState();
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

  const handleGoogleOAuth = async () => {
    try {
      if (!isSupabaseConfigured) {
        Alert.alert(
          'Supabase not configured',
          'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
        );
        return;
      }
      setOauthBusy(true);
      await signInWithGoogleOAuth();
      await refreshSession();
      await refreshAppState();
    } catch (error: any) {
      const message = error?.message ?? 'Sign-in failed.';
      if (/canceled/i.test(message)) {
        Alert.alert('Sign-in canceled', 'Authentication was canceled.');
        return;
      }
      Alert.alert('Google OAuth failed', message);
    } finally {
      setOauthBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.bgTintTop, { backgroundColor: theme.colors.surface }]} />
      <View style={[styles.bgTintBottom, { backgroundColor: theme.colors.neutral100 }]} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, theme.shadows.level2]}>
            <View style={[styles.modeRow, { backgroundColor: theme.colors.neutral100 }]}>
              <Pressable
                style={[styles.modeButton, mode === 'signIn' && styles.modeButtonActive, mode === 'signIn' && { backgroundColor: theme.colors.surface }]}
                onPress={() => setMode('signIn')}
              >
                <Text style={[styles.modeText, { color: theme.colors.textMuted }, mode === 'signIn' && styles.modeTextActive, mode === 'signIn' && { color: theme.colors.textPrimary }]}>
                  Log in
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeButton, mode === 'signUp' && styles.modeButtonActive, mode === 'signUp' && { backgroundColor: theme.colors.surface }]}
                onPress={() => setMode('signUp')}
              >
                <Text style={[styles.modeText, { color: theme.colors.textMuted }, mode === 'signUp' && styles.modeTextActive, mode === 'signUp' && { color: theme.colors.textPrimary }]}>
                  Create Account
                </Text>
              </Pressable>
            </View>

            <Text style={[styles.title, { color: theme.colors.textPrimary }, isSignUp && styles.titleCompact]}>{mode === 'signIn' ? 'Log in' : 'Create Account'}</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }, isSignUp && styles.subtitleCompact]}>
              {mode === 'signIn'
                ? 'Enter your email and password to securely access your account.'
                : 'Create a new account and set your baby profile to get started.'}
            </Text>

            <View style={[styles.inputWrap, isSignUp && styles.inputWrapCompact, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Ionicons name="mail-outline" size={18} color={theme.colors.textMuted} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="Email address"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.inputNative, { color: theme.colors.textPrimary }]}
              />
            </View>

            <View style={[styles.inputWrap, isSignUp && styles.inputWrapCompact, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                placeholder="Password"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.inputNative, { color: theme.colors.textPrimary }]}
              />
              <Pressable onPress={() => setShowPassword((prev) => !prev)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={theme.colors.textMuted} />
              </Pressable>
            </View>

            {isSignUp ? (
              <>
                <View style={[styles.inputWrap, styles.inputWrapCompact, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    placeholder="Confirm password"
                    placeholderTextColor={theme.colors.textMuted}
                    style={[styles.inputNative, { color: theme.colors.textPrimary }]}
                  />
                  <Pressable onPress={() => setShowConfirmPassword((prev) => !prev)} hitSlop={8}>
                    <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={theme.colors.textMuted} />
                  </Pressable>
                </View>
                <BabyProfileForm
                  babyName={babyName}
                  onBabyNameChange={(value) => {
                    setBabyName(value);
                    if (babyProfileError) setBabyProfileError(null);
                  }}
                  babyBirthdate={babyBirthdate}
                  onBabyBirthdateChange={(value) => {
                    setBabyBirthdate(value);
                    if (babyProfileError) setBabyProfileError(null);
                  }}
                  compact
                  errorText={babyProfileError}
                />
              </>
            ) : null}

            {mode === 'signIn' ? (
              <View style={styles.utilityRow}>
                <Pressable style={styles.checkboxRow} onPress={() => setRememberMe((prev) => !prev)}>
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                      rememberMe && [styles.checkboxChecked, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary }],
                    ]}
                  >
                    {rememberMe ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                  </View>
                  <Text style={[styles.utilityText, { color: theme.colors.textPrimary }]}>Remember me</Text>
                </Pressable>
                <Pressable onPress={() => Alert.alert('Not available yet', 'Forgot password flow is not implemented yet.')}>
                  <Text style={[styles.utilityLink, { color: theme.colors.primary }]}>Forgot Password</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable
              style={[
                styles.submitBtn,
                { backgroundColor: theme.colors.primary },
                isSignUp && styles.submitBtnCompact,
                busy && { opacity: 0.75 },
              ]}
              onPress={submit}
              disabled={busy}
            >
              <Text style={styles.submitText}>{busy ? 'Please wait...' : mode === 'signIn' ? 'Login' : 'Create Account'}</Text>
            </Pressable>

            <View style={[styles.switchRow, isSignUp && styles.switchRowCompact]}>
              <Text style={[styles.switchBase, { color: theme.colors.textSecondary }]}>
                {mode === 'signIn' ? "Don't have an account?" : 'Already have an account?'}{' '}
              </Text>
              <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
                <Text style={[styles.switchLink, { color: theme.colors.primary }]}>
                  {mode === 'signIn' ? 'Sign Up here' : 'Sign In here'}
                </Text>
              </Pressable>
            </View>

            {isSignUp ? null : (
              <>
                <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                <Text style={[styles.orText, { color: theme.colors.textSecondary }]}>Or Continue With Account</Text>
                <View style={styles.socialRow}>
                  <Pressable
                    style={[
                      styles.socialCircle,
                      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                      oauthBusy ? styles.socialDisabled : null,
                    ]}
                    onPress={handleGoogleOAuth}
                    disabled={oauthBusy}
                  >
                    <Image
                      source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/512px-Google_%22G%22_logo.svg.png' }}
                      style={styles.googleLogo}
                      resizeMode="contain"
                    />
                  </Pressable>
                </View>
              </>
            )}

            {isSignUp ? (
              <View style={styles.oauthSignupWrap}>
                <Text style={[styles.orText, { color: theme.colors.textSecondary }]}>Or Continue With Account</Text>
                <View style={styles.socialRow}>
                  <Pressable
                    style={[
                      styles.socialCircle,
                      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                      oauthBusy ? styles.socialDisabled : null,
                    ]}
                    onPress={handleGoogleOAuth}
                    disabled={oauthBusy}
                  >
                    <Image
                      source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/512px-Google_%22G%22_logo.svg.png' }}
                      style={styles.googleLogo}
                      resizeMode="contain"
                    />
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  bgTintTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '56%',
  },
  bgTintBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '44%',
  },
  flex: { flex: 1 },
  content: { padding: 18, flexGrow: 1, justifyContent: 'center' },
  card: {
    borderRadius: 30,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderWidth: 1,
  },
  modeRow: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#ffffff',
  },
  modeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  modeTextActive: {
    fontWeight: '700',
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: 0,
    marginBottom: 18,
    paddingHorizontal: 6,
  },
  titleCompact: {
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  subtitleCompact: {
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 12,
  },
  inputWrap: {
    height: 54,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputWrapCompact: {
    height: 48,
    marginBottom: 8,
  },
  inputNative: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: 0,
    paddingVertical: 0,
  },
  utilityRow: {
    marginTop: 2,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: '#2F5BFF',
    backgroundColor: '#2F5BFF',
  },
  utilityText: {
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0,
  },
  utilityLink: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: 0,
  },
  submitBtn: {
    marginTop: 2,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitBtnCompact: {
    height: 50,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  switchRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  switchRowCompact: {
    marginTop: 10,
  },
  switchBase: {
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0,
  },
  switchLink: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: 0,
  },
  divider: {
    height: 1,
    marginTop: 18,
  },
  orText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  socialRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  socialCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oauthSignupWrap: { marginTop: 12 },
  socialDisabled: { opacity: 0.5 },
  googleLogo: {
    width: 20,
    height: 20,
  },
});
