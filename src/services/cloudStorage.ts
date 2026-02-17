import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { BackupDestination } from '../types/models';

WebBrowser.maybeCompleteAuthSession();

type Provider = Extract<BackupDestination, 'google_drive' | 'dropbox'>;

type TokenRecord = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

const GOOGLE_TOKEN_KEY = 'backup_google_drive_token';
const DROPBOX_TOKEN_KEY = 'backup_dropbox_token';

const googleClientId = (process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID ?? '').trim();
const dropboxClientId = (process.env.EXPO_PUBLIC_DROPBOX_APP_KEY ?? '').trim();
const oauthRedirectScheme = (process.env.EXPO_PUBLIC_OAUTH_REDIRECT_SCHEME ?? 'com.example.babylog').trim();
const googleClientSuffix = '.apps.googleusercontent.com';

const getGoogleRedirectUri = () => {
  if (!googleClientId || !googleClientId.endsWith(googleClientSuffix)) return null;
  const appId = googleClientId.slice(0, -googleClientSuffix.length);
  return `com.googleusercontent.apps.${appId}:/oauth2redirect`;
};

const getDropboxRedirectUri = () => `${oauthRedirectScheme}://oauth2redirect`;

const tokenKey = (provider: Provider) => (provider === 'google_drive' ? GOOGLE_TOKEN_KEY : DROPBOX_TOKEN_KEY);

const saveToken = async (provider: Provider, token: TokenRecord) => {
  await SecureStore.setItemAsync(tokenKey(provider), JSON.stringify(token));
};

const readToken = async (provider: Provider): Promise<TokenRecord | null> => {
  const raw = await SecureStore.getItemAsync(tokenKey(provider));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TokenRecord;
    if (!parsed.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const disconnectCloudProvider = async (provider: Provider) => {
  await SecureStore.deleteItemAsync(tokenKey(provider));
};

export const getCloudProviderConnected = async (provider: Provider) => {
  const token = await readToken(provider);
  return Boolean(token?.accessToken);
};

const makeAuthRequest = async (provider: Provider) => {
  if (provider === 'google_drive') {
    const redirectUri = getGoogleRedirectUri();
    if (!googleClientId) throw new Error('Missing EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID');
    if (!redirectUri) throw new Error('Invalid Google client ID format.');

    const request = new AuthSession.AuthRequest({
      clientId: googleClientId,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      usePKCE: true,
      extraParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    });

    const discovery = {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
    };

    await request.makeAuthUrlAsync(discovery);
    const result = await request.promptAsync(discovery);

    if (result.type !== 'success' || !result.params.code) {
      throw new Error('Google Drive auth cancelled.');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleClientId,
        grant_type: 'authorization_code',
        code: result.params.code,
        redirect_uri: redirectUri,
        code_verifier: request.codeVerifier ?? '',
      }).toString(),
    });

    if (!tokenRes.ok) {
      throw new Error('Failed to exchange Google auth code.');
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined,
    } as TokenRecord;
  }

  if (!dropboxClientId) throw new Error('Missing EXPO_PUBLIC_DROPBOX_APP_KEY');
  const redirectUri = getDropboxRedirectUri();

  const request = new AuthSession.AuthRequest({
    clientId: dropboxClientId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ['files.content.write', 'files.content.read', 'account_info.read'],
    usePKCE: true,
    extraParams: {
      token_access_type: 'offline',
    },
  });

  const discovery = {
    authorizationEndpoint: 'https://www.dropbox.com/oauth2/authorize',
    tokenEndpoint: 'https://api.dropbox.com/oauth2/token',
  };

  await request.makeAuthUrlAsync(discovery);
  const result = await request.promptAsync(discovery);

  if (result.type !== 'success' || !result.params.code) {
    throw new Error('Dropbox auth cancelled.');
  }

  const tokenRes = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: dropboxClientId,
      grant_type: 'authorization_code',
      code: result.params.code,
      redirect_uri: redirectUri,
      code_verifier: request.codeVerifier ?? '',
    }).toString(),
  });

  if (!tokenRes.ok) {
    throw new Error('Failed to exchange Dropbox auth code.');
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined,
  } as TokenRecord;
};

const refreshIfNeeded = async (provider: Provider, token: TokenRecord): Promise<TokenRecord> => {
  if (!token.expiresAt || Date.now() < token.expiresAt - 60_000) return token;
  if (!token.refreshToken) return token;

  if (provider === 'google_drive') {
    if (!googleClientId) return token;
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleClientId,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }).toString(),
    });
    if (!response.ok) return token;
    const data = (await response.json()) as { access_token: string; expires_in?: number };
    const next = {
      ...token,
      accessToken: data.access_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : token.expiresAt,
    };
    await saveToken(provider, next);
    return next;
  }

  if (!dropboxClientId) return token;
  const response = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: dropboxClientId,
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
    }).toString(),
  });
  if (!response.ok) return token;
  const data = (await response.json()) as { access_token: string; expires_in?: number };
  const next = {
    ...token,
    accessToken: data.access_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : token.expiresAt,
  };
  await saveToken(provider, next);
  return next;
};

export const connectCloudProvider = async (provider: Provider) => {
  const token = await makeAuthRequest(provider);
  await saveToken(provider, token);
};

const fileNameFromUri = (uri: string, fallbackPrefix: string) => {
  const last = uri.split('/').pop();
  if (last && last.includes('.')) return last;
  return `${fallbackPrefix}-${Date.now()}.bin`;
};

const mimeFromName = (name: string) => {
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (name.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
};

export const uploadFileToProvider = async (provider: Provider, uri: string, options?: { fileName?: string }) => {
  let token = await readToken(provider);
  if (!token) throw new Error(`${provider === 'google_drive' ? 'Google Drive' : 'Dropbox'} is not connected.`);
  token = await refreshIfNeeded(provider, token);

  const fileName = options?.fileName ?? fileNameFromUri(uri, 'babylog-backup');
  const mimeType = mimeFromName(fileName);

  const fileResponse = await fetch(uri);
  const fileBlob = await fileResponse.blob();

  if (provider === 'google_drive') {
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: fileName, mimeType }),
    });

    if (!createRes.ok) {
      const body = await createRes.text();
      throw new Error(`Google Drive create failed: ${body}`);
    }

    const { id } = (await createRes.json()) as { id: string };
    const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': mimeType,
      },
      body: fileBlob,
    });

    if (!uploadRes.ok) {
      const body = await uploadRes.text();
      throw new Error(`Google Drive upload failed: ${body}`);
    }

    return;
  }

  const dropboxPath = `/BabyLog/${fileName}`;
  const uploadRes = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: dropboxPath,
        mode: 'add',
        autorename: true,
        mute: false,
      }),
    },
    body: fileBlob,
  });

  if (!uploadRes.ok) {
    const body = await uploadRes.text();
    throw new Error(`Dropbox upload failed: ${body}`);
  }
};
