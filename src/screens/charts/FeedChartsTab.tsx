import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { BarChart } from '../../components/BarChart';
import { LineChart } from '../../components/LineChart';
import { Button, Card, Row, SelectPill } from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { dailyFeedTotals, individualFeedAmounts, monthlyFeedTotals } from '../../db/feedRepo';
import { exportChartImage } from '../../services/exports';
import { presetDateRange } from '../../utils/dateRange';
import { CaptureChart } from '../../components/CaptureChart';
import { mlToDisplay } from '../../utils/units';

type ViewMode = 'individual' | 'daily' | 'monthly';
type ChartKind = 'bar' | 'line';

export const FeedChartsTab = () => {
  const { babyId, amountUnit, dataVersion } = useAppContext();
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [chartKind, setChartKind] = useState<ChartKind>('bar');
  const [days, setDays] = useState<7 | 30>(7);
  const [months, setMonths] = useState<3 | 6 | 12>(6);
  const [series, setSeries] = useState<Array<{ x: string; y: number }>>([]);

  const load = async () => {
    let nextSeries: Array<{ x: string; y: number }> = [];

    if (viewMode === 'individual') {
      const rows = await individualFeedAmounts(babyId, days);
      nextSeries = rows.map((row) => ({ x: row.timestamp, y: mlToDisplay(row.amount_ml ?? 0, amountUnit) }));
    }

    if (viewMode === 'daily') {
      const rows = await dailyFeedTotals(babyId, days);
      nextSeries = rows.map((row) => ({ x: row.day, y: mlToDisplay(row.total_ml, amountUnit) }));
    }

    if (viewMode === 'monthly') {
      const rows = await monthlyFeedTotals(babyId, months);
      nextSeries = rows.map((row) => ({ x: row.month, y: mlToDisplay(row.total_ml, amountUnit) }));
    }

    setSeries(nextSeries);
  };

  useEffect(() => {
    load();
  }, [babyId, amountUnit, dataVersion, viewMode, chartKind, days, months]);

  const onExportImage = async () => {
    try {
      const range = viewMode === 'monthly' ? presetDateRange('30d') : presetDateRange(days === 7 ? '7d' : '30d');
      await exportChartImage('feeds', range);
    } catch (error: any) {
      Alert.alert('Export failed', error?.message ?? 'Unable to export chart image');
    }
  };

  const chartTitle = useMemo(() => {
    if (viewMode === 'individual') return `Individual feed amounts (${amountUnit})`;
    if (viewMode === 'daily') return `Daily average feed amount (${amountUnit})`;
    return `Monthly average feed amount (${amountUnit})`;
  }, [viewMode, amountUnit]);

  const summary = useMemo(() => {
    const count = series.length;
    const total = series.reduce((sum, point) => sum + point.y, 0);
    const average = count ? total / count : 0;
    return { count, total, average };
  }, [series]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.title}>View</Text>
        <Row>
          <SelectPill label="Individual" selected={viewMode === 'individual'} onPress={() => setViewMode('individual')} />
          <SelectPill label="Daily" selected={viewMode === 'daily'} onPress={() => setViewMode('daily')} />
          <SelectPill label="Monthly" selected={viewMode === 'monthly'} onPress={() => setViewMode('monthly')} />
        </Row>

        <Text style={styles.title}>Chart Type</Text>
        <Row>
          <SelectPill label="Bar" selected={chartKind === 'bar'} onPress={() => setChartKind('bar')} />
          <SelectPill label="Line" selected={chartKind === 'line'} onPress={() => setChartKind('line')} />
        </Row>

        {viewMode === 'monthly' ? (
          <Row>
            <SelectPill label="3 mo" selected={months === 3} onPress={() => setMonths(3)} />
            <SelectPill label="6 mo" selected={months === 6} onPress={() => setMonths(6)} />
            <SelectPill label="12 mo" selected={months === 12} onPress={() => setMonths(12)} />
            <Button title="Refresh" variant="secondary" onPress={load} />
          </Row>
        ) : (
          <Row>
            <SelectPill label="7 days" selected={days === 7} onPress={() => setDays(7)} />
            <SelectPill label="30 days" selected={days === 30} onPress={() => setDays(30)} />
            <Button title="Refresh" variant="secondary" onPress={load} />
          </Row>
        )}
      </Card>

      <CaptureChart chartId="feeds">
        <Card title={chartTitle}>
          <Text style={styles.meta}>Points: {summary.count}</Text>
          {viewMode === 'individual' ? (
            <>
              <Text style={styles.meta}>Total: {summary.total.toFixed(1)} {amountUnit}</Text>
              <Text style={styles.meta}>Average: {summary.average.toFixed(1)} {amountUnit}</Text>
            </>
          ) : (
            <Text style={styles.meta}>Average across points: {summary.average.toFixed(1)} {amountUnit}</Text>
          )}
          {chartKind === 'bar' ? <BarChart data={series} /> : <LineChart data={series} color="#0ea5e9" />}
        </Card>
      </CaptureChart>

      <Button title="Export Feed Chart (PNG)" onPress={onExportImage} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, backgroundColor: '#f5f7fb', gap: 10 },
  title: { fontWeight: '600', marginBottom: 8, marginTop: 4 },
  meta: { color: '#4b5563', fontSize: 12, marginBottom: 2 },
});
