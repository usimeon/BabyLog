import { Platform } from 'react-native';

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  full: 999,
} as const;

export const typography = {
  h1: { fontSize: 32, lineHeight: 40, fontWeight: '800' as const, letterSpacing: -0.3 },
  h2: { fontSize: 28, lineHeight: 36, fontWeight: '800' as const, letterSpacing: -0.25 },
  h3: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.2 },
  h4: { fontSize: 20, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.1 },
  h5: { fontSize: 18, lineHeight: 24, fontWeight: '700' as const, letterSpacing: 0 },
  h6: { fontSize: 16, lineHeight: 22, fontWeight: '700' as const, letterSpacing: 0 },
  bodyLg: { fontSize: 17, lineHeight: 24, fontWeight: '400' as const, letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const, letterSpacing: 0 },
  bodySm: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.2 },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 0.6 },
  button: {
    fontSize: 16,
    lineHeight: Platform.OS === 'ios' ? 20 : 22,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  buttonSm: { fontSize: 14, lineHeight: 18, fontWeight: '700' as const, letterSpacing: 0.2 },
} as const;

const neutralLight = {
  0: '#FFFFFF',
  50: '#F8FAFC',
  100: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
} as const;

const neutralDark = {
  0: '#0B1220',
  50: '#0F172A',
  100: '#111827',
  200: '#1F2937',
  300: '#334155',
  400: '#475569',
  500: '#64748B',
  600: '#94A3B8',
  700: '#CBD5E1',
  800: '#E2E8F0',
  900: '#F8FAFC',
} as const;

export const palette = {
  light: {
    neutral: neutralLight,
    rose: {
      400: '#FB7185',
      500: '#F43F5E',
      600: '#E11D48',
    },
    mint: {
      400: '#34D399',
      500: '#10B981',
      600: '#059669',
    },
    amber: {
      400: '#FBBF24',
      500: '#F59E0B',
      600: '#D97706',
    },
    sky: {
      400: '#38BDF8',
      500: '#0EA5E9',
      600: '#0284C7',
    },
    red: {
      400: '#F87171',
      500: '#EF4444',
      600: '#DC2626',
    },
  },
  dark: {
    neutral: neutralDark,
    rose: {
      400: '#FB7185',
      500: '#F43F5E',
      600: '#E11D48',
    },
    mint: {
      400: '#34D399',
      500: '#10B981',
      600: '#059669',
    },
    amber: {
      400: '#FBBF24',
      500: '#F59E0B',
      600: '#D97706',
    },
    sky: {
      400: '#38BDF8',
      500: '#0EA5E9',
      600: '#0284C7',
    },
    red: {
      400: '#FCA5A5',
      500: '#F87171',
      600: '#EF4444',
    },
  },
} as const;

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceElevated: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  overlay: string;
  disabledBg: string;
  disabledText: string;
  neutral50: string;
  neutral100: string;
  neutral200: string;
  neutral300: string;
  neutral400: string;
  neutral500: string;
  neutral600: string;
  neutral700: string;
  neutral800: string;
  neutral900: string;
};

export const lightColors: ThemeColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  surfaceElevated: '#FFFFFF',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  primary: '#F43F5E',
  primaryPressed: '#E11D48',
  primarySoft: '#FFF1F2',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#0EA5E9',
  overlay: 'rgba(2, 6, 23, 0.48)',
  disabledBg: '#E2E8F0',
  disabledText: '#94A3B8',
  neutral50: '#F8FAFC',
  neutral100: '#F1F5F9',
  neutral200: '#E2E8F0',
  neutral300: '#CBD5E1',
  neutral400: '#94A3B8',
  neutral500: '#64748B',
  neutral600: '#475569',
  neutral700: '#334155',
  neutral800: '#1E293B',
  neutral900: '#0F172A',
};

export const darkColors: ThemeColors = {
  background: '#0B1220',
  surface: '#111827',
  surfaceAlt: '#1F2937',
  surfaceElevated: '#1F2937',
  border: '#334155',
  borderStrong: '#475569',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  primary: '#FB7185',
  primaryPressed: '#F43F5E',
  primarySoft: 'rgba(251, 113, 133, 0.18)',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#38BDF8',
  overlay: 'rgba(2, 6, 23, 0.62)',
  disabledBg: '#334155',
  disabledText: '#64748B',
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
};

const iosShadows = {
  0: {
    shadowColor: '#000',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  1: {
    shadowColor: '#020617',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  2: {
    shadowColor: '#020617',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  3: {
    shadowColor: '#020617',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
} as const;

const androidShadows = {
  0: { elevation: 0 },
  1: { elevation: 2 },
  2: { elevation: 4 },
  3: { elevation: 8 },
} as const;

export const elevation = (Platform.OS === 'ios' ? iosShadows : androidShadows) as Record<
  0 | 1 | 2 | 3,
  Record<string, number | string | { width: number; height: number }>
>;
