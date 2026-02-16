import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'BabyLog',
  slug: 'babylog',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'babylog',
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
    googleDriveClientId: process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID,
    dropboxAppKey: process.env.EXPO_PUBLIC_DROPBOX_APP_KEY,
  },
});
