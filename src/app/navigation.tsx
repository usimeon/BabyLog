import React from 'react';
import { ActivityIndicator, Pressable, Text, useColorScheme, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { TodayScreen } from '../screens/TodayScreen';
import { AddEntryScreen } from '../screens/AddEntryScreen';
import { LogsScreen } from '../screens/LogsScreen';
import { ChartsScreen } from '../screens/ChartsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { BabyProfileGateScreen } from '../screens/BabyProfileGateScreen';
import { getTheme } from '../theme/designSystem';

export type RootStackParamList = {
  Main: undefined;
  Charts: undefined;
  Settings: undefined;
  AddEntry:
    | {
        type?: 'feed' | 'measurement' | 'temperature' | 'diaper' | 'medication' | 'milestone';
        entryId?: string;
      }
    | undefined;
  Auth: undefined;
};

export type MainTabParamList = {
  Today: undefined;
  QuickAdd: undefined;
  Logs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const tabIcon = (routeName: keyof MainTabParamList, focused: boolean, color: string, size: number) => {
  if (routeName === 'Today') {
    return <Ionicons name={focused ? 'sunny' : 'sunny-outline'} size={size} color={color} />;
  }

  if (routeName === 'QuickAdd') {
    return <Ionicons name="add" size={size + 2} color={color} />;
  }

  if (routeName === 'Logs') {
    return <Ionicons name={focused ? 'list' : 'list-outline'} size={size} color={color} />;
  }
  return <Ionicons name="add" size={size + 2} color={color} />;
};

const MainTabs = ({ initials }: { initials: string }) => {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === 'dark' ? 'dark' : 'light');
  const activeTabColor = theme.colors.primary;

  return (
    <Tabs.Navigator
      screenOptions={({ route, navigation }) => ({
      headerTitleStyle: {
        fontWeight: '600',
        fontSize: 18,
        lineHeight: 24,
        letterSpacing: 0,
        color: theme.colors.textPrimary,
      },
      headerStyle: {
        backgroundColor: theme.colors.background,
      },
      headerShadowVisible: false,
      headerLeftContainerStyle: { paddingLeft: 16 },
      headerRightContainerStyle: { paddingRight: 16 },
      tabBarShowLabel: true,
      tabBarActiveTintColor: activeTabColor,
      tabBarInactiveTintColor: theme.colors.textMuted,
      tabBarLabelStyle: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.2, marginBottom: 3 },
      tabBarStyle: {
        height: 72,
        paddingTop: 6,
        paddingBottom: 8,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        overflow: 'visible',
      },
      headerLeft: () => (
        <View style={{ width: 88, height: 40, justifyContent: 'center' }}>
          <View
            style={{
              position: 'absolute',
              left: 0,
              zIndex: 3,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#FFE194',
              borderWidth: 2,
              borderColor: theme.colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#7A5A00', fontSize: 14, fontWeight: '700' }}>A</Text>
          </View>
          <View
            style={{
              position: 'absolute',
              left: 15,
              zIndex: 2,
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: '#FFB085',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#7C3A1D', fontSize: 13, fontWeight: '700' }}>B</Text>
          </View>
          <View
            style={{
              position: 'absolute',
              left: 30,
              zIndex: 1,
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: '#90AACB',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>C</Text>
          </View>
        </View>
      ),
      headerRight: () => {
        const parentNav = navigation.getParent<any>();
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable
              onPress={() => parentNav?.navigate('Charts')}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              hitSlop={8}
            >
              <Ionicons name="bar-chart-outline" size={20} color={theme.colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => parentNav?.navigate('Settings')}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              hitSlop={8}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{initials}</Text>
            </Pressable>
          </View>
        );
      },
      tabBarIcon: ({ focused, color }) => tabIcon(route.name as keyof MainTabParamList, focused, color, 24),
    })}
  >
    <Tabs.Screen name="Today" component={TodayScreen} options={{ title: 'Today', tabBarLabel: 'Today' }} />
    <Tabs.Screen
      name="QuickAdd"
      component={TodayScreen}
      options={{
        title: '',
        tabBarLabel: '',
        tabBarIcon: () => null,
        tabBarButton: ({ onPress, onLongPress, accessibilityState, accessibilityLabel, testID }) => (
          <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="button"
            accessibilityState={accessibilityState}
            accessibilityLabel={accessibilityLabel}
            testID={testID}
            style={{
              position: 'absolute',
              left: '50%',
              transform: [{ translateX: -32 }],
              top: -22,
              justifyContent: 'center',
              alignItems: 'center',
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: activeTabColor,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 34, lineHeight: 34, fontWeight: '500' }}>+</Text>
          </Pressable>
        ),
      }}
      listeners={({ navigation }) => ({
        tabPress: (e) => {
          e.preventDefault();
          const parentNav = navigation.getParent<any>();
          parentNav?.navigate('AddEntry', { type: 'feed' });
        },
      })}
    />
    <Tabs.Screen name="Logs" component={LogsScreen} options={{ title: 'Logs', tabBarLabel: 'Logs' }} />
  </Tabs.Navigator>
  );
};

export const AppNavigation = () => {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === 'dark' ? 'dark' : 'light');
  const { initialized, supabaseEnabled, session, hasRequiredBabyProfile } = useAppContext();

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const requiresAuth = supabaseEnabled && !session;
  const requiresBabyProfile = supabaseEnabled && Boolean(session) && !hasRequiredBabyProfile;
  const initials = session?.user?.email ? session.user.email.charAt(0).toUpperCase() : 'B';
  const navTheme = scheme === 'dark' ? { ...DarkTheme } : { ...DefaultTheme };
  navTheme.colors.background = theme.colors.background;
  navTheme.colors.card = theme.colors.surface;
  navTheme.colors.text = theme.colors.textPrimary;
  navTheme.colors.border = theme.colors.border;
  navTheme.colors.primary = theme.colors.primary;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerShadowVisible: false,
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
            color: theme.colors.textPrimary,
          },
          headerTintColor: theme.colors.textPrimary,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {requiresAuth ? (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        ) : requiresBabyProfile ? (
          <Stack.Screen name="Auth" component={BabyProfileGateScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Main" options={{ headerShown: false }}>
              {() => <MainTabs initials={initials} />}
            </Stack.Screen>
            <Stack.Screen name="Charts" component={ChartsScreen} options={{ title: 'Charts' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Profile' }} />
            <Stack.Screen name="AddEntry" component={AddEntryScreen} options={{ title: 'Add Entry' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
