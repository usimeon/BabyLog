import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/ui';
import { calculateFeedSummary } from '../db/feedRepo';
import { useAppContext } from '../context/AppContext';
import { RootStackParamList } from '../app/navigation';
import { formatTime } from '../utils/time';
import { mlToDisplay } from '../utils/units';
import { FeedSummary } from '../types/models';
import { SyncBanner } from '../components/SyncBanner';
import { getRoutineSuggestions } from '../services/routineSuggestions';
import { getAiDailyInsights, mergeDailySuggestions } from '../services/aiInsights';
import { AiSuggestion } from '../types/ai';
import { AppTheme } from '../theme/designSystem';
import { useAppTheme } from '../theme/useAppTheme';

export const TodayScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { babyId, reminderSettings, amountUnit, syncNow, syncState, syncError, lastSyncAt, supabaseEnabled, dataVersion } =
    useAppContext();

  const [summary, setSummary] = useState<FeedSummary>({
    lastFeedTime: undefined as string | undefined,
    nextReminderTime: undefined as string | undefined,
    totalAmountTodayMl: 0,
    averageIntervalHours: 0,
  });
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);

  const load = useCallback(async () => {
    const [nextSummary, nextRuleSuggestions, nextAiInsights] = await Promise.all([
      calculateFeedSummary(babyId, reminderSettings.intervalHours),
      getRoutineSuggestions(babyId),
      getAiDailyInsights(babyId),
    ]);

    setSummary(nextSummary);
    setSuggestions(mergeDailySuggestions(nextRuleSuggestions, nextAiInsights, 4));
  }, [babyId, reminderSettings.intervalHours]);

  useFocusEffect(
    useCallback(() => {
      load();
      syncNow();
    }, [load, syncNow]),
  );

  React.useEffect(() => {
    load();
  }, [dataVersion, load]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}> 
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
          <View style={styles.heroHead}>
            <View style={[styles.heroIconWrap, { backgroundColor: theme.colors.primarySoft }]}> 
              <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={[styles.heroTitle, { color: theme.colors.textPrimary }]}>Add Entry</Text>
              <Text style={[styles.heroSubtitle, { color: theme.colors.textSecondary }]}>Log feed, growth, temperature, diaper, medication, or milestone.</Text>
            </View>
          </View>
          <Pressable style={[styles.logButton, { backgroundColor: theme.colors.primary }]} onPress={() => navigation.navigate('AddEntry')}>
            <Text style={styles.logButtonText}>Log</Text>
          </Pressable>
        </View>

        <SyncBanner syncState={syncState} syncError={syncError} lastSyncAt={lastSyncAt} enabled={supabaseEnabled} />

        <Card title="Today Snapshot">
          <Text style={[styles.valueLabel, { color: theme.colors.textSecondary }]}>Last feed</Text>
          <Text style={[styles.value, { color: theme.colors.textPrimary }]}>{formatTime(summary.lastFeedTime)}</Text>

          <Text style={[styles.valueLabel, { color: theme.colors.textSecondary }]}>Next reminder</Text>
          <Text style={[styles.value, { color: theme.colors.textPrimary }]}>{formatTime(summary.nextReminderTime)}</Text>

          <Text style={[styles.valueLabel, { color: theme.colors.textSecondary }]}>Total today ({amountUnit})</Text>
          <Text style={[styles.value, { color: theme.colors.textPrimary }]}>{mlToDisplay(summary.totalAmountTodayMl, amountUnit).toFixed(1)}</Text>
        </Card>

        <Card title="Routine Suggestions">
          {suggestions.map((item) => (
            <View
              key={item.id}
              style={[styles.suggestionItem, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }]}
            >
              <View style={styles.suggestionHeader}>
                <Text style={[styles.suggestionTitle, { color: theme.colors.textPrimary }]}>{item.title}</Text>
                {item.source === 'ai' ? <Text style={[styles.aiTag, { color: theme.colors.info, borderColor: theme.colors.info }]}>AI</Text> : null}
              </View>
              <Text style={[styles.suggestionDetail, { color: theme.colors.textSecondary }]}>{item.detail}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    safe: { flex: 1 },
    content: { padding: theme.spacing[4], gap: theme.spacing[2] },
    hero: {
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      padding: theme.spacing[4],
      gap: theme.spacing[3],
    },
    heroHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
    },
    heroIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCopy: {
      flex: 1,
      gap: 2,
    },
    heroTitle: { ...theme.typography.h5, fontWeight: '800' },
    heroSubtitle: { ...theme.typography.bodySm },
    logButton: {
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing[3],
      alignItems: 'center',
      justifyContent: 'center',
    },
    logButtonText: {
      color: '#FFFFFF',
      ...theme.typography.button,
      fontWeight: '700',
    },
    valueLabel: { ...theme.typography.caption, marginTop: theme.spacing[2] },
    value: { ...theme.typography.h4, fontWeight: '800', marginBottom: theme.spacing[1] },
    suggestionItem: {
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.spacing[3],
      marginBottom: theme.spacing[2],
    },
    suggestionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[2] },
    suggestionTitle: { ...theme.typography.bodyLg, fontWeight: '700', marginBottom: theme.spacing[1] },
    suggestionDetail: { ...theme.typography.bodySm },
    aiTag: {
      ...theme.typography.caption,
      borderWidth: 1,
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.spacing[2],
      paddingVertical: 2,
      overflow: 'hidden',
      fontWeight: '700',
    },
  });
