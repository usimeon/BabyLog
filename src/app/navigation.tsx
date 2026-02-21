import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AddEntryScreen } from '../screens/AddEntryScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { BabyProfileGateScreen } from '../screens/BabyProfileGateScreen';
import { ChartsScreen } from '../screens/ChartsScreen';
import { LogsScreen } from '../screens/LogsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TodayScreen } from '../screens/TodayScreen';
import { useAppContext } from '../context/AppContext';
import { AppTheme } from '../theme/designSystem';
import { useAppTheme } from '../theme/useAppTheme';

export type RootStackParamList = {
  Main: undefined;
  Charts: undefined;
  Settings: undefined;
  BabyOnboarding: { mode?: 'required' | 'new' } | undefined;
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
  if (routeName === 'Today') return <Ionicons name={focused ? 'sunny' : 'sunny-outline'} size={size} color={color} />;
  if (routeName === 'QuickAdd') return <Ionicons name="add" size={size + 2} color={color} />;
  return <Ionicons name={focused ? 'list' : 'list-outline'} size={size} color={color} />;
};

const MainTabs = ({
  initials,
  babyInitial,
  babyId,
  babies,
  switchActiveBaby,
}: {
  initials: string;
  babyInitial: string;
  babyId: string;
  babies: Array<{ id: string; name: string; photoUri?: string | null; birthdate?: string | null }>;
  switchActiveBaby: (babyId: string) => Promise<void>;
}) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherHint, setSwitcherHint] = useState<string | null>(null);

  const activeBaby = useMemo(() => babies.find((baby) => baby.id === babyId) ?? null, [babies, babyId]);
  const activeBabyPhotoUri = activeBaby?.photoUri ?? null;

  const inactiveBabyInitial = useMemo(() => {
    const inactive = babies.find((baby) => baby.id !== babyId);
    return inactive ? (inactive.name.trim().charAt(0) || 'B').toUpperCase() : null;
  }, [babies, babyId]);

  const onPressBabyAvatar = () => {
    if (babies.length <= 1) {
      setSwitcherHint('Add another baby profile to switch quickly.');
    } else {
      setSwitcherHint(null);
    }
    setSwitcherOpen(true);
  };

  return (
    <>
      <Tabs.Navigator
        screenOptions={({ route, navigation }) => ({
          headerTitleStyle: [styles.headerTitle, { color: theme.colors.textPrimary }],
          headerStyle: [styles.header, { backgroundColor: theme.colors.background }],
          headerShadowVisible: false,
          headerLeftContainerStyle: styles.headerLeftContainer,
          headerRightContainerStyle: styles.headerRightContainer,
          tabBarShowLabel: true,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarStyle: [styles.tabBar, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface }],
          headerLeft: () => (
            <Pressable
              style={styles.avatarStackTrigger}
              onPress={onPressBabyAvatar}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Switch active baby"
            >
              {inactiveBabyInitial ? (
                <View style={[styles.inactiveAvatar, { borderColor: theme.colors.surface }]}>
                  <Text style={[styles.inactiveAvatarText, { color: theme.colors.textMuted }]}>{inactiveBabyInitial}</Text>
                </View>
              ) : null}
              <View style={[styles.activeAvatar, { borderColor: theme.colors.surface }]}>
                {activeBabyPhotoUri ? (
                  <Image source={{ uri: activeBabyPhotoUri }} style={styles.activeAvatarImage} />
                ) : (
                  <Text style={styles.activeAvatarText}>{babyInitial}</Text>
                )}
              </View>
            </Pressable>
          ),
          headerRight: () => {
            const parentNav = navigation.getParent<any>();
            return (
              <View style={styles.headerRightRow}>
                <Pressable
                  onPress={() => parentNav?.navigate('Charts')}
                  style={styles.iconButton}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Open charts"
                >
                  <Ionicons name="bar-chart-outline" size={20} color={theme.colors.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => parentNav?.navigate('Settings')}
                  style={[styles.profileButton, { backgroundColor: theme.colors.primary }]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Open profile settings"
                >
                  <Text style={styles.profileButtonText}>{initials}</Text>
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
                accessibilityLabel={accessibilityLabel ?? 'Quick add entry'}
                testID={testID}
                style={[styles.quickAddButton, { backgroundColor: theme.colors.primary }, theme.shadows.level3]}
              >
                <Text style={styles.quickAddText}>+</Text>
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

      <Modal transparent visible={switcherOpen} animationType="fade" onRequestClose={() => setSwitcherOpen(false)}>
        <Pressable onPress={() => setSwitcherOpen(false)} style={[styles.switcherOverlay, { backgroundColor: theme.colors.overlay }]}>
          <Pressable
            onPress={() => {}}
            style={[
              styles.switcherSheet,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
              theme.shadows.level2,
            ]}
          >
            <Text style={[styles.switcherTitle, { color: theme.colors.textPrimary }]}>Switch Baby</Text>
            <Text style={[styles.switcherSubtitle, { color: theme.colors.textSecondary }]}>Choose active baby</Text>
            {switcherHint ? (
              <Text style={[styles.switcherHint, { color: theme.colors.textSecondary }]}>
                {switcherHint}
              </Text>
            ) : null}

            {babies.map((baby) => {
              const isActive = baby.id === babyId;
              const initial = (baby.name.trim().charAt(0) || 'B').toUpperCase();
              return (
                <Pressable
                  key={baby.id}
                  onPress={() => {
                    setSwitcherOpen(false);
                    if (isActive) return;
                    void switchActiveBaby(baby.id);
                  }}
                  style={[
                    styles.switcherRow,
                    {
                      backgroundColor: isActive ? theme.colors.primarySoft : theme.colors.background,
                      borderColor: isActive ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Switch to ${baby.name}`}
                  accessibilityState={{ selected: isActive }}
                >
                  <View style={styles.switcherRowLeft}>
                    <View
                      style={[
                        styles.switcherRowAvatar,
                        {
                          borderColor: isActive ? theme.colors.primary : theme.colors.border,
                          backgroundColor: isActive ? theme.colors.primarySoft : theme.colors.surfaceAlt,
                        },
                      ]}
                    >
                      {baby.photoUri ? (
                        <Image source={{ uri: baby.photoUri }} style={styles.switcherRowAvatarImage} />
                      ) : (
                        <Text
                          style={[
                            styles.switcherRowAvatarText,
                            { color: isActive ? theme.colors.primary : theme.colors.textSecondary },
                          ]}
                        >
                          {initial}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.switcherRowText, { color: isActive ? theme.colors.primary : theme.colors.textPrimary }]}>
                      {baby.name}
                    </Text>
                  </View>
                  {isActive ? <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} /> : null}
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => setSwitcherOpen(false)}
              style={[styles.cancelButton, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel switching baby"
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.textPrimary }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

export const AppNavigation = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { initialized, supabaseEnabled, session, hasRequiredBabyProfile, babyName, babyId, babies, switchActiveBaby } =
    useAppContext();

  if (!initialized) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const requiresAuth = supabaseEnabled && !session;
  const hasCreatedBabyFallback = babies.some((baby) => {
    const normalizedName = baby.name.trim().toLowerCase();
    const hasRealName = normalizedName.length > 0 && normalizedName !== 'my baby';
    const hasBirthdate = Boolean(baby.birthdate && baby.birthdate.trim().length > 0);
    return hasRealName || hasBirthdate;
  });
  const requiresBabyProfile = supabaseEnabled && Boolean(session) && !hasRequiredBabyProfile && !hasCreatedBabyFallback;
  const stackKey = requiresAuth ? 'auth' : requiresBabyProfile ? 'required-onboarding' : 'app';
  const initials = session?.user?.email ? session.user.email.charAt(0).toUpperCase() : 'B';
  const babyInitial = (babyName?.trim().charAt(0) || 'B').toUpperCase();
  const navTheme = theme.mode === 'dark' ? { ...DarkTheme } : { ...DefaultTheme };

  navTheme.colors.background = theme.colors.background;
  navTheme.colors.card = theme.colors.surface;
  navTheme.colors.text = theme.colors.textPrimary;
  navTheme.colors.border = theme.colors.border;
  navTheme.colors.primary = theme.colors.primary;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        key={stackKey}
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
        ) : requiresBabyProfile ? (
          <Stack.Screen
            name="BabyOnboarding"
            component={BabyProfileGateScreen}
            options={{ headerShown: false, gestureEnabled: false }}
            initialParams={{ mode: 'required' }}
          />
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
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    loaderContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    header: {
      elevation: 0,
    },
    headerTitle: {
      ...theme.typography.h6,
      fontWeight: '700',
    },
    headerLeftContainer: {
      paddingLeft: theme.spacing[4],
    },
    headerRightContainer: {
      paddingRight: theme.spacing[4],
    },
    tabBar: {
      height: 72,
      paddingTop: theme.spacing[1],
      paddingBottom: theme.spacing[2],
      borderTopWidth: 1,
      overflow: 'visible',
    },
    tabBarLabel: {
      ...theme.typography.caption,
      marginBottom: 3,
    },
    avatarStackTrigger: {
      width: 62,
      height: 40,
      justifyContent: 'center',
    },
    inactiveAvatar: {
      position: 'absolute',
      left: 18,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#CBD5E1',
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inactiveAvatarText: {
      ...theme.typography.caption,
      fontWeight: '700',
    },
    activeAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#FFE194',
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    activeAvatarText: {
      ...theme.typography.bodySm,
      color: '#7A5A00',
      fontWeight: '800',
    },
    activeAvatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 20,
    },
    headerRightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileButtonText: {
      ...theme.typography.bodySm,
      color: '#FFFFFF',
      fontWeight: '800',
    },
    quickAddButton: {
      position: 'absolute',
      left: '50%',
      transform: [{ translateX: -32 }],
      top: -22,
      width: 64,
      height: 64,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quickAddText: {
      color: '#FFFFFF',
      fontSize: 34,
      lineHeight: 34,
      fontWeight: '500',
    },
    switcherOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing[5],
    },
    switcherSheet: {
      width: '100%',
      maxWidth: 360,
      borderRadius: theme.radius.lg,
      padding: theme.spacing[4],
      borderWidth: 1,
      gap: theme.spacing[2],
    },
    switcherTitle: {
      ...theme.typography.h4,
      fontWeight: '800',
    },
    switcherSubtitle: {
      ...theme.typography.bodySm,
      marginBottom: theme.spacing[1],
    },
    switcherHint: {
      ...theme.typography.caption,
      marginBottom: theme.spacing[1],
    },
    switcherRow: {
      minHeight: 48,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      paddingHorizontal: theme.spacing[3],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    switcherRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
      flex: 1,
    },
    switcherRowAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    switcherRowAvatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 15,
    },
    switcherRowAvatarText: {
      ...theme.typography.caption,
      fontWeight: '700',
    },
    switcherRowText: {
      ...theme.typography.bodySm,
      fontWeight: '700',
    },
    cancelButton: {
      minHeight: 48,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing[1],
    },
    cancelButtonText: {
      ...theme.typography.buttonSm,
      fontWeight: '700',
    },
  });
