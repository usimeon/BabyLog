import React, { useCallback, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card } from '../components/ui';
import { calculateFeedSummary } from '../db/feedRepo';
import { useAppContext } from '../context/AppContext';
import { RootStackParamList } from '../app/navigation';
import { formatTime } from '../utils/time';
import { mlToDisplay } from '../utils/units';
import { FeedSummary } from '../types/models';
import { SyncBanner } from '../components/SyncBanner';

export const TodayScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { babyId, reminderSettings, amountUnit, syncNow, syncState, syncError, lastSyncAt, supabaseEnabled } =
    useAppContext();
  const [summary, setSummary] = useState<FeedSummary>({
    lastFeedTime: undefined as string | undefined,
    nextReminderTime: undefined as string | undefined,
    totalAmountTodayMl: 0,
    averageIntervalHours: 0,
  });

  const load = useCallback(async () => {
    const next = await calculateFeedSummary(babyId, reminderSettings.intervalHours);
    setSummary(next);
  }, [babyId, reminderSettings.intervalHours]);

  useFocusEffect(
    useCallback(() => {
      load();
      syncNow();
    }, [load]),
  );

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

        <View style={{ gap: 10 }}>
          <Button
            title="Add Feed"
            onPress={() => {
              navigation.navigate('AddFeed');
            }}
          />
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
});
