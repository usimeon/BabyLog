import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AddEntryScreen } from '../screens/AddEntryScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { BabyProfileGateScreen } from '../screens/BabyProfileGateScreen';
import { ChartsScreen } from '../screens/ChartsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useAppContext } from '../context/AppContext';
import { useAppTheme } from '../theme/useAppTheme';
import { MainTabs } from './MainTabs';
import { createNavigationStyles } from './navigation.styles';
import { getNavigationGate } from './navigationGate';
import { RootStackParamList } from './navigation.types';

export type { MainTabParamList, RootStackParamList } from './navigation.types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const toNavigationTheme = (
  mode: 'light' | 'dark',
  colors: { background: string; surface: string; textPrimary: string; border: string; primary: string },
) => {
  const navTheme = mode === 'dark' ? { ...DarkTheme } : { ...DefaultTheme };
  navTheme.colors.background = colors.background;
  navTheme.colors.card = colors.surface;
  navTheme.colors.text = colors.textPrimary;
  navTheme.colors.border = colors.border;
  navTheme.colors.primary = colors.primary;
  return navTheme;
};

export const AppNavigation = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createNavigationStyles(theme), [theme]);
  const {
    initialized,
    appStateHydrating,
    forceMainAfterOnboarding,
    supabaseEnabled,
    session,
    hasRequiredBabyProfile,
    babyName,
    babyId,
    babies,
    switchActiveBaby,
    syncState,
  } = useAppContext();

  const { requiresAuth, requiresBabyProfile, stackKey } = getNavigationGate({
    supabaseEnabled,
    hasSession: Boolean(session),
    hasRequiredBabyProfile,
    appStateHydrating,
    forceMainAfterOnboarding,
    syncState,
    babyName,
    babies,
  });

  useEffect(() => {
    if (!__DEV__) return;
    console.log(
      `[nav-gate] initialized=${initialized} requiresAuth=${requiresAuth} requiresBabyProfile=${requiresBabyProfile} hasRequiredBabyProfile=${hasRequiredBabyProfile} forceMainAfterOnboarding=${forceMainAfterOnboarding} appStateHydrating=${appStateHydrating} syncState=${syncState} babyId=${babyId} babies=${babies.length} stackKey=${stackKey}`,
    );
  }, [
    initialized,
    requiresAuth,
    requiresBabyProfile,
    hasRequiredBabyProfile,
    forceMainAfterOnboarding,
    appStateHydrating,
    syncState,
    babyId,
    babies.length,
    stackKey,
  ]);

  if (!initialized) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const initials = session?.user?.email ? session.user.email.charAt(0).toUpperCase() : 'B';
  const babyInitial = (babyName?.trim().charAt(0) || 'B').toUpperCase();
  const navTheme = toNavigationTheme(theme.mode, {
    background: theme.colors.background,
    surface: theme.colors.surface,
    textPrimary: theme.colors.textPrimary,
    border: theme.colors.border,
    primary: theme.colors.primary,
  });
  const navigatorKey = requiresAuth ? 'auth' : 'app';
  const initialRouteName: keyof RootStackParamList = requiresAuth
    ? 'Auth'
    : requiresBabyProfile
      ? 'BabyOnboarding'
      : 'Main';

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        key={navigatorKey}
        initialRouteName={initialRouteName}
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerShadowVisible: false,
          headerTitleStyle: [styles.headerTitle, { color: theme.colors.textPrimary }],
          headerTintColor: theme.colors.textPrimary,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {requiresAuth ? (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Main" options={{ headerShown: false }}>
              {() => (
                <MainTabs
                  initials={initials}
                  babyInitial={babyInitial}
                  babyId={babyId}
                  babies={babies}
                  switchActiveBaby={switchActiveBaby}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Charts" component={ChartsScreen} options={{ title: 'Charts' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Profile' }} />
            <Stack.Screen name="AddEntry" component={AddEntryScreen} options={{ title: 'Add Entry' }} />
            <Stack.Screen
              name="BabyOnboarding"
              component={BabyProfileGateScreen}
              options={{ headerShown: false, gestureEnabled: !requiresBabyProfile }}
              initialParams={{ mode: 'required' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
