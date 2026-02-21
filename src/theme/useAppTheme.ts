import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { AppTheme, getTheme } from './designSystem';

export const useAppTheme = (): AppTheme => {
  const scheme = useColorScheme();
  return useMemo(() => getTheme(scheme === 'dark' ? 'dark' : 'light'), [scheme]);
};
