import { Platform } from 'react-native';

export type ThemeMode = 'light' | 'dark';

const typography = {
  h1: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.3 },
  h2: { fontSize: 26, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 22, lineHeight: 30, fontWeight: '600' as const, letterSpacing: -0.1 },
  h4: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const, letterSpacing: 0 },
  bodyLarge: { fontSize: 17, lineHeight: 24, fontWeight: '400' as const, letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const, letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.2 },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '600' as const, letterSpacing: 0.2 },
};

const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
};

const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 999,
};

const lightColors = {
  primary: '#F77575',
  neutral50: '#FFF8F3',
  neutral100: '#FFF1E8',
  neutral200: '#E2E8F0',
  neutral300: '#CBD5E1',
  neutral400: '#94A3B8',
  neutral500: '#64748B',
  neutral600: '#475569',
  neutral700: '#334155',
  neutral800: '#1E293B',
  neutral900: '#0F172A',
  success: '#16A34A',
  warning: '#FFB085',
  error: '#DC2626',
  info: '#0284C7',
  background: '#FFF8F3',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
};

const darkColors = {
  primary: '#FF9A8A',
  neutral50: '#1F2937',
  neutral100: '#1F2937',
  neutral200: '#334155',
  neutral300: '#475569',
  neutral400: '#64748B',
  neutral500: '#94A3B8',
  neutral600: '#CBD5E1',
  neutral700: '#E2E8F0',
  neutral800: '#F1F5F9',
  neutral900: '#F8FAFC',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#F87171',
  info: '#38BDF8',
  background: '#0B1220',
  surface: '#111827',
  surfaceElevated: '#1F2937',
  border: '#334155',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
};

const iosShadow = {
  level1: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  level2: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  level3: {
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
};

const androidShadow = {
  level1: { elevation: 2 },
  level2: { elevation: 4 },
  level3: { elevation: 8 },
};

const shadows = Platform.OS === 'ios' ? iosShadow : androidShadow;

export const getTheme = (mode: ThemeMode = 'light') => ({
  colors: mode === 'dark' ? darkColors : lightColors,
  typography,
  spacing,
  radius,
  shadows,
});
