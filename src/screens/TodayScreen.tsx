import React, { useCallback, useState } from 'react';
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
import { getRoutineSuggestions, RoutineSuggestion } from '../services/routineSuggestions';

export const TodayScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { babyId, reminderSettings, amountUnit, syncNow, syncState, syncError, lastSyncAt, supabaseEnabled, dataVersion } =
    useAppContext();
  const [summary, setSummary] = useState<FeedSummary>({
    lastFeedTime: undefined as string | undefined,
    nextReminderTime: undefined as string | undefined,
    totalAmountTodayMl: 0,
    averageIntervalHours: 0,
  });
  const [suggestions, setSuggestions] = useState<RoutineSuggestion[]>([]);

  const load = useCallback(async () => {
    const [nextSummary, nextSuggestions] = await Promise.all([
      calculateFeedSummary(babyId, reminderSettings.intervalHours),
      getRoutineSuggestions(babyId),
    ]);
    setSummary(nextSummary);
    setSuggestions(nextSuggestions);
  }, [babyId, reminderSettings.intervalHours]);

  useFocusEffect(
    useCallback(() => {
      load();
      syncNow();
    }, [load]),
  );

  React.useEffect(() => {
    load();
  }, [dataVersion, load]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Add Entry</Text>
          <Text style={styles.heroSubtitle}>Log feed, growth, temperature, diaper, meds, or milestones.</Text>
          <Pressable style={styles.logButton} onPress={() => navigation.navigate('AddEntry')}>
            <Text style={styles.logButtonText}>Log</Text>
          </Pressable>
          <Pressable style={styles.voiceButton} onPress={() => navigation.navigate('VoiceQuickEntry')}>
            <Ionicons name="mic" size={16} color="#1f2937" />
            <Text style={styles.voiceButtonText}>Voice Quick Entry</Text>
          </Pressable>
        </View>

        <SyncBanner
          syncState={syncState}
          syncError={syncError}
          lastSyncAt={lastSyncAt}
          enabled={supabaseEnabled}
        />

        <Card title="Today Snapshot">
          <Text style={styles.valueLabel}>Last feed</Text>
          <Text style={styles.value}>{formatTime(summary.lastFeedTime)}</Text>

          <Text style={styles.valueLabel}>Next reminder</Text>
          <Text style={styles.value}>{formatTime(summary.nextReminderTime)}</Text>

          <Text style={styles.valueLabel}>Total today ({amountUnit})</Text>
          <Text style={styles.value}>{mlToDisplay(summary.totalAmountTodayMl, amountUnit).toFixed(1)}</Text>
        </Card>

        <Card title="Routine Suggestions">
          {suggestions.map((item) => (
            <View key={item.id} style={styles.suggestionItem}>
              <Text style={styles.suggestionTitle}>{item.title}</Text>
              <Text style={styles.suggestionDetail}>{item.detail}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 16, gap: 10 },
  hero: {
    backgroundColor: '#e0e7ff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 14,
  },
  heroTitle: { color: '#1e3a8a', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  heroSubtitle: { color: '#334155', fontSize: 13, marginBottom: 12 },
  logButton: {
    backgroundColor: '#F77575',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  voiceButton: {
    marginTop: 8,
    backgroundColor: '#FFE194',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  voiceButtonText: {
    color: '#1f2937',
    fontWeight: '600',
  },
  valueLabel: { color: '#6b7280', fontSize: 13, marginTop: 8 },
  value: { color: '#111827', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  suggestionItem: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  suggestionTitle: { color: '#0f172a', fontWeight: '700', marginBottom: 4 },
  suggestionDetail: { color: '#334155', fontSize: 13 },
});
