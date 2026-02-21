import { darkColors, elevation, lightColors, radius, spacing, ThemeColors, typography } from './tokens';

export type ThemeMode = 'light' | 'dark';
export type AppTheme = {
  mode: ThemeMode;
  colors: ThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  elevation: typeof elevation;
  shadows: {
    level0: typeof elevation[0];
    level1: typeof elevation[1];
    level2: typeof elevation[2];
    level3: typeof elevation[3];
  };
};

const lightTheme: AppTheme = {
  mode: 'light',
  colors: lightColors,
  typography,
  spacing,
  radius,
  elevation,
  shadows: {
    level0: elevation[0],
    level1: elevation[1],
    level2: elevation[2],
    level3: elevation[3],
  },
};

const darkTheme: AppTheme = {
  mode: 'dark',
  colors: darkColors,
  typography,
  spacing,
  radius,
  elevation,
  shadows: {
    level0: elevation[0],
    level1: elevation[1],
    level2: elevation[2],
    level3: elevation[3],
  },
};

export const getTheme = (mode: ThemeMode = 'light'): AppTheme => (mode === 'dark' ? darkTheme : lightTheme);
