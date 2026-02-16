import React, { useCallback, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card } from '../components/ui';
import { calculateFeedSummary } from '../db/feedRepo';
import { getWeeklyInsights, WeeklyInsights } from '../db/insightsRepo';
import { useAppContext } from '../context/AppContext';
import { RootStackParamList } from '../app/navigation';
import { formatTime } from '../utils/time';
import { mlToDisplay } from '../utils/units';
import { FeedSummary } from '../types/models';
import { SyncBanner } from '../components/SyncBanner';
import { AiSummary, generateAiSummary, getCachedAiSummary } from '../services/aiInsights';

export const TodayScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    babyId,
    reminderSettings,
    amountUnit,
    syncNow,
    syncState,
    syncError,
    lastSyncAt,
    supabaseEnabled,
    dataVersion,
    aiEnabled,
  } = useAppContext();
  const [summary, setSummary] = useState<FeedSummary>({
    lastFeedTime: undefined as string | undefined,
    nextReminderTime: undefined as string | undefined,
    totalAmountTodayMl: 0,
    averageIntervalHours: 0,
  });
  const [insights, setInsights] = useState<WeeklyInsights>({
    avgFeedsPerDay: 0,
    avgDiapersPerDay: 0,
    avgTempsPerDay: 0,
    feedStreakDays: 0,
  });
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const load = useCallback(async () => {
    const [nextSummary, nextInsights] = await Promise.all([
      calculateFeedSummary(babyId, reminderSettings.intervalHours),
      getWeeklyInsights(babyId),
    ]);
    setSummary(nextSummary);
    setInsights(nextInsights);
    const cached = await getCachedAiSummary();
    setAiSummary(cached);
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

  const onGenerateAiSummary = async () => {
    try {
      setAiBusy(true);
      const summary = await generateAiSummary(babyId);
      setAiSummary(summary);
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <SyncBanner
          syncState={syncState}
          syncError={syncError}
          lastSyncAt={lastSyncAt}
          enabled={supabaseEnabled}
        />
        <Card title="Today">
          <Text style={styles.valueLabel}>Last feed</Text>
          <Text style={styles.value}>{formatTime(summary.lastFeedTime)}</Text>

          <Text style={styles.valueLabel}>Next reminder</Text>
          <Text style={styles.value}>{formatTime(summary.nextReminderTime)}</Text>

          <Text style={styles.valueLabel}>Total today ({amountUnit})</Text>
          <Text style={styles.value}>{mlToDisplay(summary.totalAmountTodayMl, amountUnit).toFixed(1)}</Text>

          <Text style={styles.valueLabel}>Avg interval (24h)</Text>
          <Text style={styles.value}>{summary.averageIntervalHours.toFixed(2)} hrs</Text>
        </Card>

        <Card title="Weekly Insights">
          <View style={styles.insightRow}>
            <View style={styles.insightBox}>
              <Text style={styles.insightValue}>{insights.avgFeedsPerDay.toFixed(1)}</Text>
              <Text style={styles.insightLabel}>avg feeds/day</Text>
            </View>
            <View style={styles.insightBox}>
              <Text style={styles.insightValue}>{insights.avgDiapersPerDay.toFixed(1)}</Text>
              <Text style={styles.insightLabel}>avg diapers/day</Text>
            </View>
            <View style={styles.insightBox}>
              <Text style={styles.insightValue}>{insights.avgTempsPerDay.toFixed(1)}</Text>
              <Text style={styles.insightLabel}>avg temp checks/day</Text>
            </View>
          </View>
          <Text style={styles.streakText}>Feed streak: {insights.feedStreakDays} day(s)</Text>
        </Card>

        <Card title="AI Insights">
          {aiEnabled ? (
            <>
              {aiSummary?.bullets?.length ? (
                <>
                  {aiSummary.bullets.map((bullet, idx) => (
                    <Text key={`${idx}-${bullet.slice(0, 12)}`} style={styles.aiBullet}>
                      • {bullet}
                    </Text>
                  ))}
                  <Text style={styles.aiMeta}>
                    {aiSummary.source === 'remote' ? 'AI source: remote' : 'AI source: local fallback'} •{' '}
                    {new Date(aiSummary.generatedAt).toLocaleString()}
                  </Text>
                  <Text style={styles.aiDisclaimer}>{aiSummary.disclaimer}</Text>
                </>
              ) : (
                <Text style={styles.aiMeta}>No AI summary generated yet.</Text>
              )}
              <Button title={aiBusy ? 'Generating...' : 'Generate AI Summary'} onPress={onGenerateAiSummary} />
            </>
          ) : (
            <Text style={styles.aiMeta}>AI summaries are disabled in Settings.</Text>
          )}
        </Card>

        <View style={{ gap: 10 }}>
          <View style={styles.quickRow}>
            <Button title="+ Feed" onPress={() => navigation.navigate('AddEntry', { type: 'feed' })} />
            <Button title="+ Growth" variant="secondary" onPress={() => navigation.navigate('AddEntry', { type: 'measurement' })} />
          </View>
          <View style={styles.quickRow}>
            <Button title="+ Temp" variant="secondary" onPress={() => navigation.navigate('AddEntry', { type: 'temperature' })} />
            <Button title="+ Diaper" variant="secondary" onPress={() => navigation.navigate('AddEntry', { type: 'diaper' })} />
          </View>
          <Button title="Refresh" variant="secondary" onPress={load} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 16 },
  valueLabel: { color: '#6b7280', fontSize: 13, marginTop: 8 },
  value: { color: '#111827', fontSize: 24, fontWeight: '700', marginBottom: 4 },
  insightRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  insightBox: {
    flex: 1,
    minWidth: 96,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
  },
  insightValue: { fontSize: 19, fontWeight: '700', color: '#0f172a' },
  insightLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
  streakText: { marginTop: 10, fontSize: 13, color: '#334155', fontWeight: '600' },
  quickRow: { flexDirection: 'row', gap: 8 },
  aiBullet: { color: '#1f2937', fontSize: 13, marginBottom: 6 },
  aiMeta: { color: '#475569', fontSize: 12, marginBottom: 8 },
  aiDisclaimer: { color: '#64748b', fontSize: 11, marginBottom: 10 },
});
