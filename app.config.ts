import type { ExpoConfig, ConfigContext } from 'expo/config';

const oauthRedirectScheme = process.env.EXPO_PUBLIC_OAUTH_REDIRECT_SCHEME ?? 'com.example.babylog';
const googleDriveClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
const googleIdSuffix = '.apps.googleusercontent.com';
const googleRedirectScheme =
  googleDriveClientId && googleDriveClientId.endsWith(googleIdSuffix)
    ? `com.googleusercontent.apps.${googleDriveClientId.slice(0, -googleIdSuffix.length)}`
    : undefined;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'BabyLog',
  slug: 'babylog',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: googleRedirectScheme ? [oauthRedirectScheme, googleRedirectScheme] : oauthRedirectScheme,
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
  plugins: ['expo-sqlite', '@react-native-community/datetimepicker', 'expo-secure-store', 'expo-web-browser'],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    googleDriveClientId,
    dropboxAppKey: process.env.EXPO_PUBLIC_DROPBOX_APP_KEY,
    oauthRedirectScheme,
    googleRedirectScheme,
  },
});
