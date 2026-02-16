import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { TodayScreen } from '../screens/TodayScreen';
import { AddEntryScreen } from '../screens/AddEntryScreen';
import { FeedHistoryScreen } from '../screens/FeedHistoryScreen';
import { MeasurementsScreen } from '../screens/MeasurementsScreen';
import { CareScreen } from '../screens/CareScreen';
import { ChartsScreen } from '../screens/ChartsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AuthScreen } from '../screens/AuthScreen';

export type RootStackParamList = {
  Main: undefined;
  AddEntry: { type?: 'feed' | 'measurement' | 'temperature' | 'diaper' } | undefined;
  Auth: undefined;
};

export type MainTabParamList = {
  Today: undefined;
  FeedHistory: undefined;
  Measurements: undefined;
  Care: undefined;
  Charts: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const tabIcon = (routeName: keyof MainTabParamList, focused: boolean, color: string, size: number) => {
  if (routeName === 'Today') {
    return <Ionicons name={focused ? 'sunny' : 'sunny-outline'} size={size} color={color} />;
  }

  if (routeName === 'FeedHistory') {
    return <MaterialCommunityIcons name={focused ? 'baby-bottle' : 'baby-bottle-outline'} size={size} color={color} />;
  }

  if (routeName === 'Measurements') {
    return <MaterialCommunityIcons name={focused ? 'scale-bathroom' : 'scale-bathroom'} size={size} color={color} />;
  }

  if (routeName === 'Care') {
    return <Ionicons name={focused ? 'water' : 'water-outline'} size={size} color={color} />;
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
    <Tabs.Screen name="FeedHistory" component={FeedHistoryScreen} options={{ title: 'Feed History', tabBarLabel: 'Feeds' }} />
    <Tabs.Screen name="Measurements" component={MeasurementsScreen} options={{ title: 'Measurements', tabBarLabel: 'Growth' }} />
    <Tabs.Screen name="Care" component={CareScreen} options={{ title: 'Care', tabBarLabel: 'Care' }} />
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
