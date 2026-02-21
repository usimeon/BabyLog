import React, { useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LogsScreen } from '../screens/LogsScreen';
import { TodayScreen } from '../screens/TodayScreen';
import { useAppTheme } from '../theme/useAppTheme';
import { createNavigationStyles } from './navigation.styles';
import { BabySwitcherModal } from './BabySwitcherModal';
import { MainTabParamList, NavBaby } from './navigation.types';

const Tabs = createBottomTabNavigator<MainTabParamList>();

const tabIcon = (routeName: keyof MainTabParamList, focused: boolean, color: string, size: number) => {
  if (routeName === 'Today') return <Ionicons name={focused ? 'sunny' : 'sunny-outline'} size={size} color={color} />;
  if (routeName === 'QuickAdd') return <Ionicons name="add" size={size + 2} color={color} />;
  return <Ionicons name={focused ? 'list' : 'list-outline'} size={size} color={color} />;
};

type MainTabsProps = {
  initials: string;
  babyInitial: string;
  babyId: string;
  babies: NavBaby[];
  switchActiveBaby: (babyId: string) => Promise<void>;
};

export const MainTabs = ({ initials, babyInitial, babyId, babies, switchActiveBaby }: MainTabsProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createNavigationStyles(theme), [theme]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherHint, setSwitcherHint] = useState<string | null>(null);

  const activeBaby = useMemo(() => babies.find((baby) => baby.id === babyId) ?? null, [babies, babyId]);
  const inactiveBabyInitial = useMemo(() => {
    const inactive = babies.find((baby) => baby.id !== babyId);
    return inactive ? (inactive.name.trim().charAt(0) || 'B').toUpperCase() : null;
  }, [babies, babyId]);

  const onPressBabyAvatar = () => {
    setSwitcherHint(babies.length <= 1 ? 'Add another baby profile to switch quickly.' : null);
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
                {activeBaby?.photoUri ? (
                  <Image source={{ uri: activeBaby.photoUri }} style={styles.activeAvatarImage} />
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
                <Pressable onPress={() => parentNav?.navigate('Charts')} style={styles.iconButton} hitSlop={8} accessibilityRole="button" accessibilityLabel="Open charts">
                  <Ionicons name="bar-chart-outline" size={20} color={theme.colors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => parentNav?.navigate('Settings')} style={[styles.profileButton, { backgroundColor: theme.colors.primary }]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Open profile settings">
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

      <BabySwitcherModal
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        hint={switcherHint}
        babies={babies}
        activeBabyId={babyId}
        switchActiveBaby={switchActiveBaby}
      />
    </>
  );
};
