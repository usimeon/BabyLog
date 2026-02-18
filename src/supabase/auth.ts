import { supabase } from './client';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const oauthRedirectScheme = (process.env.EXPO_PUBLIC_OAUTH_REDIRECT_SCHEME ?? 'com.example.babylog').trim();

const makeOAuthRedirectUri = () =>
  AuthSession.makeRedirectUri({
    scheme: oauthRedirectScheme,
    path: 'auth/callback',
  });

const parseHashParams = (url: string) => {
  const fragment = url.split('#')[1] ?? '';
  return new URLSearchParams(fragment);
};

const isUserCancelResult = (resultType: string) => resultType === 'cancel' || resultType === 'dismiss';

export const signUpWithEmail = async (email: string, password: string) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
};

export const signInWithEmail = async (email: string, password: string) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
};

export const signInWithGoogleOAuth = async () => {
  if (!supabase) throw new Error('Supabase is not configured.');

  const redirectTo = makeOAuthRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'consent', access_type: 'offline' },
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('Failed to start OAuth flow.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (isUserCancelResult(result.type)) throw new Error('Sign-in was canceled.');
  if (result.type !== 'success' || !result.url) throw new Error('OAuth flow did not complete.');

  const parsedUrl = new URL(result.url);
  const code = parsedUrl.searchParams.get('code');
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return;
  }

  const hash = parseHashParams(result.url);
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (setSessionError) throw setSessionError;
    return;
  }

  throw new Error('OAuth session exchange failed.');
};

export const signOut = async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentSession = async () => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
};

