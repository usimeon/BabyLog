import React, { useEffect, useState } from 'react';
import {
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
import { ToastBanner, ToastBannerKind } from '../components/ToastBanner';
import { signInWithEmail, signInWithGoogleOAuth, signUpWithEmail } from '../supabase/auth';
import { isSupabaseConfigured } from '../supabase/client';
import { useAppContext } from '../context/AppContext';
import { getTheme } from '../theme/designSystem';

type AuthField = 'email' | 'password' | 'confirmPassword';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 72;

const formatAuthErrorMessage = (error: any, mode: 'signIn' | 'signUp') => {
  const raw = String(error?.message ?? '').trim();
  const normalized = raw.toLowerCase();

  if (
    normalized.includes('email rate limit exceeded') ||
    normalized.includes('rate limit') ||
    normalized.includes('too many requests')
  ) {
    return mode === 'signUp'
      ? 'Too many sign-up attempts. Please wait a few minutes and try again.'
      : 'Too many attempts. Please wait a few minutes and try again.';
  }

  if (mode === 'signIn') {
    if (
      normalized.includes('user not found') ||
      normalized.includes('email not found') ||
      normalized.includes('no user') ||
      normalized.includes('account not found')
    ) {
      return 'Please sign up.';
    }

    if (
      normalized.includes('invalid login credentials') ||
      normalized.includes('invalid credentials') ||
      normalized.includes('wrong password') ||
      normalized.includes('invalid password')
    ) {
      return 'Wrong password.';
    }
  }

  return raw || 'Authentication failed.';
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
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: ToastBannerKind; message: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AuthField, string>>>({});
  const isSignUp = mode === 'signUp';

  const showBanner = (message: string, kind: ToastBannerKind = 'info') => {
    setBanner({ kind, message });
  };

  const clearFieldError = (field: AuthField) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    setFieldErrors({});
  }, [mode]);

  const submit = async () => {
    try {
      const nextErrors: Partial<Record<AuthField, string>> = {};
      const trimmedEmail = email.trim().toLowerCase();
      const passwordValue = password;
      const confirmPasswordValue = confirmPassword;

      if (!trimmedEmail) {
        nextErrors.email = 'Email is required.';
      } else if (!EMAIL_REGEX.test(trimmedEmail)) {
        nextErrors.email = 'Enter a valid email address.';
      }

      if (!passwordValue) {
        nextErrors.password = 'Password is required.';
      } else if (passwordValue.length < MIN_PASSWORD_LENGTH) {
        nextErrors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
      } else if (passwordValue.length > MAX_PASSWORD_LENGTH) {
        nextErrors.password = `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`;
      }

      if (mode === 'signUp') {
        if (!confirmPasswordValue) {
          nextErrors.confirmPassword = 'Confirm password is required.';
        } else if (confirmPasswordValue !== passwordValue) {
          nextErrors.confirmPassword = 'Confirm password must match.';
        }
      }

      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        const firstError = Object.values(nextErrors)[0];
        if (firstError) showBanner(firstError, 'error');
        return;
      }

      setFieldErrors({});
      setBusy(true);
      if (!isSupabaseConfigured) {
        showBanner('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.', 'error');
        return;
      }

      if (mode === 'signIn') {
        await signInWithEmail(trimmedEmail, passwordValue);
      } else {
        await signUpWithEmail(trimmedEmail, passwordValue);
        showBanner('Account created. Sign in, then complete onboarding.', 'success');
        setMode('signIn');
      }
      await refreshSession();
    } catch (error: any) {
      showBanner(formatAuthErrorMessage(error, mode), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleOAuth = async () => {
    try {
      if (!isSupabaseConfigured) {
        showBanner('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.', 'error');
        return;
      }
      setOauthBusy(true);
      await signInWithGoogleOAuth();
      await refreshSession();
      await refreshAppState();
    } catch (error: any) {
      const message = error?.message ?? 'Sign-in failed.';
      if (/canceled/i.test(message)) {
        showBanner('Authentication was canceled.', 'info');
        return;
      }
      showBanner(message, 'error');
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
            {banner ? <ToastBanner kind={banner.kind} message={banner.message} onDismiss={() => setBanner(null)} /> : null}

            <Text style={[styles.title, { color: theme.colors.textPrimary }, isSignUp && styles.titleCompact]}>{mode === 'signIn' ? 'Log in' : 'Create Account'}</Text>

            <View
              style={[
                styles.inputWrap,
                isSignUp && styles.inputWrapCompact,
                { backgroundColor: theme.colors.surface, borderColor: fieldErrors.email ? theme.colors.error : theme.colors.border },
              ]}
            >
              <Ionicons name="mail-outline" size={18} color={theme.colors.textMuted} />
              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  clearFieldError('email');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="Email address"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.inputNative, { color: theme.colors.textPrimary }]}
              />
            </View>
            {fieldErrors.email ? <Text style={[styles.fieldError, { color: theme.colors.error }]}>{fieldErrors.email}</Text> : null}

            <View
              style={[
                styles.inputWrap,
                isSignUp && styles.inputWrapCompact,
                { backgroundColor: theme.colors.surface, borderColor: fieldErrors.password ? theme.colors.error : theme.colors.border },
              ]}
            >
              <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />
              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  clearFieldError('password');
                }}
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
            {fieldErrors.password ? (
              <Text style={[styles.fieldError, { color: theme.colors.error }]}>{fieldErrors.password}</Text>
            ) : null}

            {isSignUp ? (
              <View
                style={[
                  styles.inputWrap,
                  styles.inputWrapCompact,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: fieldErrors.confirmPassword ? theme.colors.error : theme.colors.border,
                  },
                ]}
              >
                <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />
                <TextInput
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    clearFieldError('confirmPassword');
                  }}
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
            ) : null}
            {isSignUp && fieldErrors.confirmPassword ? (
              <Text style={[styles.fieldError, { color: theme.colors.error }]}>{fieldErrors.confirmPassword}</Text>
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
                <Pressable onPress={() => showBanner('Forgot password flow is not available yet.', 'info')}>
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
  title: {
    fontSize: 32,
    lineHeight: 40,
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  titleCompact: {
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.2,
    marginBottom: 10,
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
  fieldError: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    marginTop: -2,
    marginBottom: 8,
    marginLeft: 6,
    letterSpacing: 0.2,
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
