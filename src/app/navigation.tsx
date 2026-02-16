import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAppContext } from '../context/AppContext';
import { TodayScreen } from '../screens/TodayScreen';
import { AddFeedScreen } from '../screens/AddFeedScreen';
import { AddEntryScreen } from '../screens/AddEntryScreen';
import { FeedHistoryScreen } from '../screens/FeedHistoryScreen';
import { MeasurementsScreen } from '../screens/MeasurementsScreen';
import { CareScreen } from '../screens/CareScreen';
import { ChartsScreen } from '../screens/ChartsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AuthScreen } from '../screens/AuthScreen';

export type RootStackParamList = {
  Main: undefined;
  AddFeed: { feedId?: string } | undefined;
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

const MainTabs = () => (
  <Tabs.Navigator>
    <Tabs.Screen name="Today" component={TodayScreen} options={{ title: 'Today' }} />
    <Tabs.Screen name="FeedHistory" component={FeedHistoryScreen} options={{ title: 'Feed History' }} />
    <Tabs.Screen name="Measurements" component={MeasurementsScreen} options={{ title: 'Measurements' }} />
    <Tabs.Screen name="Care" component={CareScreen} options={{ title: 'Care' }} />
    <Tabs.Screen name="Charts" component={ChartsScreen} options={{ title: 'Charts' }} />
    <Tabs.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
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
            <Stack.Screen name="AddFeed" component={AddFeedScreen} options={{ title: 'Feed' }} />
            <Stack.Screen name="AddEntry" component={AddEntryScreen} options={{ title: 'Add Entry' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
