import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
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
  Charts: undefined;
  Settings: undefined;
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
  QuickAdd: undefined;
  Logs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const activeTabColor = '#f77575';

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

const MainTabs = ({ initials }: { initials: string }) => (
  <Tabs.Navigator
    screenOptions={({ route, navigation }) => ({
      headerTitleStyle: { fontWeight: '700', color: '#111827' },
      headerStyle: {
        backgroundColor: 'transparent',
      },
      headerShadowVisible: false,
      headerLeftContainerStyle: { paddingLeft: 16 },
      headerRightContainerStyle: { paddingRight: 16 },
      tabBarShowLabel: true,
      tabBarActiveTintColor: activeTabColor,
      tabBarInactiveTintColor: '#6b7280',
      tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginBottom: 3 },
      tabBarStyle: {
        height: 78,
        paddingTop: 6,
        paddingBottom: 10,
        borderTopWidth: 1,
        borderTopColor: '#d1d5db',
        backgroundColor: '#ffffff',
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
              borderColor: '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#7a5a00', fontSize: 14, fontWeight: '700' }}>A</Text>
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
            <Text style={{ color: '#7c3a1d', fontSize: 13, fontWeight: '700' }}>B</Text>
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
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              hitSlop={8}
            >
              <Ionicons name="bar-chart-outline" size={16} color="#4b5563" />
            </Pressable>
            <Pressable
              onPress={() => parentNav?.navigate('Settings')}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: '#90AACB',
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
      tabBarIcon: ({ focused, color }) => tabIcon(route.name as keyof MainTabParamList, focused, color, 22),
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
  const initials = session?.user?.email ? session.user.email.charAt(0).toUpperCase() : 'B';

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {requiresAuth ? (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Main" options={{ headerShown: false }}>
              {() => <MainTabs initials={initials} />}
            </Stack.Screen>
            <Stack.Screen name="Charts" component={ChartsScreen} options={{ title: 'Charts' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Profile' }} />
            <Stack.Screen name="AddEntry" component={AddEntryScreen} options={{ title: 'Add Entry' }} />
            <Stack.Screen name="VoiceQuickEntry" component={VoiceQuickEntryScreen} options={{ title: 'Voice Quick Entry' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
