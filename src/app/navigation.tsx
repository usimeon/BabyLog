import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
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
import { VoiceQuickEntryScreen } from '../screens/VoiceQuickEntryScreen';

export type RootStackParamList = {
  Main: undefined;
  AddEntry:
    | {
        type?: 'feed' | 'measurement' | 'temperature' | 'diaper' | 'medication' | 'milestone';
        entryId?: string;
      }
    | undefined;
  VoiceQuickEntry: undefined;
  Auth: undefined;
};

export type MainTabParamList = {
  Today: undefined;
  Logs: undefined;
  Charts: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const tabIcon = (routeName: keyof MainTabParamList, focused: boolean, color: string, size: number) => {
  if (routeName === 'Today') {
    return <Ionicons name={focused ? 'sunny' : 'sunny-outline'} size={size} color={color} />;
  }

  if (routeName === 'Logs') {
    return <Ionicons name={focused ? 'list' : 'list-outline'} size={size} color={color} />;
  }

  if (routeName === 'Charts') {
    return <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={size} color={color} />;
  }

  return <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />;
};

const MainTabs = () => (
  <Tabs.Navigator
    screenOptions={({ route }) => ({
      headerTitleStyle: { fontWeight: '700', color: '#111827' },
      tabBarShowLabel: true,
      tabBarActiveTintColor: '#2563eb',
      tabBarInactiveTintColor: '#6b7280',
      tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginBottom: 3 },
      tabBarStyle: {
        height: 78,
        paddingTop: 6,
        paddingBottom: 10,
        borderTopWidth: 1,
        borderTopColor: '#d1d5db',
        backgroundColor: '#ffffff',
      },
      tabBarIcon: ({ focused, color }) => tabIcon(route.name as keyof MainTabParamList, focused, color, 22),
    })}
  >
    <Tabs.Screen name="Today" component={TodayScreen} options={{ title: 'Today', tabBarLabel: 'Today' }} />
    <Tabs.Screen name="Logs" component={LogsScreen} options={{ title: 'Logs', tabBarLabel: 'Logs' }} />
    <Tabs.Screen name="Charts" component={ChartsScreen} options={{ title: 'Charts', tabBarLabel: 'Charts' }} />
    <Tabs.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings', tabBarLabel: 'Settings' }} />
  </Tabs.Navigator>
);

export const AppNavigation = () => {
  const { initialized, supabaseEnabled, session } = useAppContext();

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const requiresAuth = supabaseEnabled && !session;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {requiresAuth ? (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="AddEntry" component={AddEntryScreen} options={{ title: 'Add Entry' }} />
            <Stack.Screen name="VoiceQuickEntry" component={VoiceQuickEntryScreen} options={{ title: 'Voice Quick Entry' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
