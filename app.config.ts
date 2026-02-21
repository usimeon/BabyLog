import type { ExpoConfig, ConfigContext } from 'expo/config';

const oauthRedirectScheme = process.env.EXPO_PUBLIC_OAUTH_REDIRECT_SCHEME ?? 'com.example.babylog';
const googleIdSuffix = '.apps.googleusercontent.com';

const googleDriveLegacyClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
const googleDriveIosClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID;
const googleDriveAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID;
const googleDriveWebClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID;
const googleDrivePrimaryClientId =
  googleDriveIosClientId ?? googleDriveAndroidClientId ?? googleDriveLegacyClientId ?? googleDriveWebClientId;

const toGoogleRedirectScheme = (clientId?: string) =>
  clientId && clientId.endsWith(googleIdSuffix)
    ? `com.googleusercontent.apps.${clientId.slice(0, -googleIdSuffix.length)}`
    : null;

const schemeSet = new Set<string>([oauthRedirectScheme]);
for (const candidate of [
  toGoogleRedirectScheme(googleDriveLegacyClientId),
  toGoogleRedirectScheme(googleDriveIosClientId),
  toGoogleRedirectScheme(googleDriveAndroidClientId),
]) {
  if (candidate) {
    schemeSet.add(candidate);
  }
}
const appSchemes = Array.from(schemeSet);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'BabyLog',
  slug: 'babylog',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: appSchemes.length === 1 ? appSchemes[0] : appSchemes,
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.example.babylog',
    infoPlist: {
      NSUserNotificationUsageDescription: 'BabyLog uses reminders to notify you when the next feed is due.',
    },
  },
  plugins: [
    'expo-sqlite',
    '@react-native-community/datetimepicker',
    'expo-secure-store',
    'expo-web-browser',
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    googleDriveClientId: googleDriveLegacyClientId,
    googleDriveIosClientId,
    googleDriveAndroidClientId,
    googleDriveWebClientId,
    dropboxAppKey: process.env.EXPO_PUBLIC_DROPBOX_APP_KEY,
    oauthRedirectScheme,
    googleRedirectScheme: toGoogleRedirectScheme(googleDrivePrimaryClientId),
  },
});
