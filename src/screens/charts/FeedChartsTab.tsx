import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { BarChart } from '../../components/BarChart';
import { Button, Card, Row, SelectPill } from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { dailyFeedTotals, intervalTrend } from '../../db/feedRepo';
import { exportChartImage } from '../../services/exports';
import { presetDateRange } from '../../utils/dateRange';
import { CaptureChart } from '../../components/CaptureChart';
import { mlToDisplay } from '../../utils/units';

export const FeedChartsTab = () => {
  const { babyId, amountUnit } = useAppContext();
  const [days, setDays] = useState<7 | 30>(7);
  const [dailyData, setDailyData] = useState<Array<{ x: string; y: number }>>([]);
  const [intervalData, setIntervalData] = useState<Array<{ x: string; y: number }>>([]);

  const load = async () => {
    const [daily, intervals] = await Promise.all([dailyFeedTotals(babyId, days), intervalTrend(babyId, days)]);
    setDailyData(
      daily.map((point) => ({
        x: point.day,
        y: mlToDisplay(point.total_ml, amountUnit),
      })),
    );
    setIntervalData(intervals.map((point) => ({ x: point.x, y: point.hours })));
  };

  useEffect(() => {
    load();
  }, [babyId, days, amountUnit]);

  const onExportImage = async () => {
    try {
      await exportChartImage('feeds', presetDateRange(days === 7 ? '7d' : '30d'));
    } catch (error: any) {
      Alert.alert('Export failed', error?.message ?? 'Unable to export chart image');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.title}>Range</Text>
        <Row>
          <SelectPill label="7 days" selected={days === 7} onPress={() => setDays(7)} />
          <SelectPill label="30 days" selected={days === 30} onPress={() => setDays(30)} />
          <Button title="Refresh" variant="secondary" onPress={load} />
        </Row>
      </Card>

      <CaptureChart chartId="feeds">
        <Card title={`Daily feed totals (${amountUnit})`}>
          <BarChart data={dailyData} />
        </Card>

        <Card title="Interval trend (hours)">
          <BarChart data={intervalData} color="#f59e0b" />
        </Card>
      </CaptureChart>

      <Button title="Export Feed Chart (PNG)" onPress={onExportImage} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, backgroundColor: '#f5f7fb', gap: 10 },
  title: { fontWeight: '600', marginBottom: 8 },
});
