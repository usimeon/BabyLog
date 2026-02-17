import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { BarChart } from '../components/BarChart';
import { CaptureChart } from '../components/CaptureChart';
import { LineChart } from '../components/LineChart';
import { WeightForAgeChart } from '../components/WeightForAgeChart';
import { Card, Row, SelectPill } from '../components/ui';
import { useAppContext } from '../context/AppContext';
import { getBabyById } from '../db/babyRepo';
import { dailyFeedTotals, individualFeedAmounts, monthlyFeedTotals } from '../db/feedRepo';
import { listMeasurements } from '../db/measurementRepo';
import { listTemperatureLogs } from '../db/temperatureRepo';
import { estimateWeightPercentile, percentileBandForMonth } from '../utils/growthPercentiles';
import { cToDisplay, kgToDisplay, mlToDisplay } from '../utils/units';

type FeedViewMode = 'individual' | 'daily' | 'monthly';
type ChartKind = 'bar' | 'line';
type CareDays = 7 | 30;

const inLastDays = (iso: string, days: number) => {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(iso).getTime() >= cutoff;
};

const niceStep = (value: number) => {
  if (value <= 20) return 2;
  if (value <= 80) return 5;
  if (value <= 200) return 10;
  if (value <= 500) return 25;
  return 50;
};

export const ChartsScreen = () => {
  const { babyId, amountUnit, weightUnit, tempUnit, dataVersion } = useAppContext();

  const [feedViewMode, setFeedViewMode] = useState<FeedViewMode>('daily');
  const [feedChartKind, setFeedChartKind] = useState<ChartKind>('line');
  const [feedDays, setFeedDays] = useState<7 | 30>(7);
  const [feedMonths, setFeedMonths] = useState<3 | 6 | 12>(6);
  const [feedSeries, setFeedSeries] = useState<Array<{ x: string; y: number }>>([]);

  const [weightPoints, setWeightPoints] = useState<Array<{ x: number; y: number; yKg: number }>>([]);

  const [careDays, setCareDays] = useState<CareDays>(7);
  const [tempSeries, setTempSeries] = useState<Array<{ x: string; y: number }>>([]);

  useEffect(() => {
    const loadFeeds = async () => {
      let nextSeries: Array<{ x: string; y: number }> = [];
      if (feedViewMode === 'individual') {
        const rows = await individualFeedAmounts(babyId, feedDays);
        nextSeries = rows.map((row) => ({ x: row.timestamp, y: mlToDisplay(row.amount_ml ?? 0, amountUnit) }));
      }
      if (feedViewMode === 'daily') {
        const rows = await dailyFeedTotals(babyId, feedDays);
        nextSeries = rows.map((row) => ({ x: row.day, y: mlToDisplay(row.total_ml, amountUnit) }));
      }
      if (feedViewMode === 'monthly') {
        const rows = await monthlyFeedTotals(babyId, feedMonths);
        nextSeries = rows.map((row) => ({ x: row.month, y: mlToDisplay(row.total_ml, amountUnit) }));
      }
      setFeedSeries(nextSeries);
    };

    loadFeeds();
  }, [babyId, amountUnit, dataVersion, feedViewMode, feedDays, feedMonths]);

  useEffect(() => {
    const loadWeights = async () => {
      const [rows, baby] = await Promise.all([listMeasurements(babyId), getBabyById(babyId)]);
      const ordered = [...rows].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      if (!ordered.length) {
        setWeightPoints([]);
        return;
      }
      const baseMs = baby?.birthdate ? new Date(baby.birthdate).getTime() : new Date(ordered[0].timestamp).getTime();
      setWeightPoints(
        ordered.map((row) => {
          const ageMonths = Math.max(0, (new Date(row.timestamp).getTime() - baseMs) / (30.44 * 24 * 60 * 60 * 1000));
          return { x: ageMonths, y: kgToDisplay(row.weight_kg, weightUnit), yKg: row.weight_kg };
        }),
      );
    };

    loadWeights();
  }, [babyId, weightUnit, dataVersion]);

  useEffect(() => {
    const loadCare = async () => {
      const temps = await listTemperatureLogs(babyId);
      const next = temps
        .filter((x) => inLastDays(x.timestamp, careDays))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .map((x) => ({ x: x.timestamp, y: cToDisplay(Number(x.temperature_c), tempUnit) }));
      setTempSeries(next);
    };

    loadCare();
  }, [babyId, tempUnit, careDays, dataVersion]);

  const feedTitle = useMemo(() => {
    if (feedViewMode === 'individual') return `Individual feed amounts (${amountUnit})`;
    if (feedViewMode === 'daily') return `Daily average feed amount (${amountUnit})`;
    return `Monthly average feed amount (${amountUnit})`;
  }, [feedViewMode, amountUnit]);
  const feedXAxisLabel = useMemo(() => {
    if (feedViewMode === 'individual') return 'Entries';
    if (feedViewMode === 'daily') return 'Days';
    return 'Months';
  }, [feedViewMode]);

  const feedSummary = useMemo(() => {
    const count = feedSeries.length;
    const total = feedSeries.reduce((sum, point) => sum + point.y, 0);
    const average = count ? total / count : 0;
    return { count, total, average };
  }, [feedSeries]);

  const feedAxis = useMemo(() => {
    if (!feedSeries.length) return { yMin: 0, yMax: 1 };
    const values = feedSeries.map((point) => point.y);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (feedViewMode === 'individual') {
      const step = niceStep(max - min || max || 1);
      const yMin = Math.max(0, Math.floor((min * 0.95) / step) * step);
      const yMax = Math.max(yMin + step, Math.ceil((max * 1.05) / step) * step);
      return { yMin, yMax };
    }
    const step = niceStep(max || 1);
    const yMin = 0;
    const yMax = Math.max(step, Math.ceil((max * 1.1) / step) * step);
    return { yMin, yMax };
  }, [feedSeries, feedViewMode]);

  const weightOverlay = useMemo(() => {
    if (!weightPoints.length) return null;
    const latestMonth = weightPoints[weightPoints.length - 1].x;
    const xMax = Math.max(24, Math.ceil(latestMonth / 2) * 2);
    const months = Array.from({ length: xMax + 1 }, (_, month) => month);
    const p10 = months.map((month) => ({ x: month, y: kgToDisplay(percentileBandForMonth(month).p10, weightUnit) }));
    const p50 = months.map((month) => ({ x: month, y: kgToDisplay(percentileBandForMonth(month).p50, weightUnit) }));
    const p90 = months.map((month) => ({ x: month, y: kgToDisplay(percentileBandForMonth(month).p90, weightUnit) }));
    const latest = weightPoints[weightPoints.length - 1];
    const latestPercentile = estimateWeightPercentile(latest.x, latest.yKg);
    return { p10, p50, p90, latestPercentile, xMax };
  }, [weightPoints, weightUnit]);

  const peakTemp = useMemo(() => (tempSeries.length ? Math.max(...tempSeries.map((x) => x.y)) : 0), [tempSeries]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card title="Feeds">
        <Text style={styles.title}>View</Text>
        <Row>
          <SelectPill label="Individual" selected={feedViewMode === 'individual'} onPress={() => setFeedViewMode('individual')} />
          <SelectPill label="Daily" selected={feedViewMode === 'daily'} onPress={() => setFeedViewMode('daily')} />
          <SelectPill label="Monthly" selected={feedViewMode === 'monthly'} onPress={() => setFeedViewMode('monthly')} />
        </Row>
        <Text style={styles.title}>Chart Type</Text>
        <Row>
          <SelectPill label="Bar" selected={feedChartKind === 'bar'} onPress={() => setFeedChartKind('bar')} />
          <SelectPill label="Line" selected={feedChartKind === 'line'} onPress={() => setFeedChartKind('line')} />
        </Row>
        {feedViewMode === 'monthly' ? (
          <Row>
            <SelectPill label="3 mo" selected={feedMonths === 3} onPress={() => setFeedMonths(3)} />
            <SelectPill label="6 mo" selected={feedMonths === 6} onPress={() => setFeedMonths(6)} />
            <SelectPill label="12 mo" selected={feedMonths === 12} onPress={() => setFeedMonths(12)} />
          </Row>
        ) : (
          <Row>
            <SelectPill label="7 days" selected={feedDays === 7} onPress={() => setFeedDays(7)} />
            <SelectPill label="30 days" selected={feedDays === 30} onPress={() => setFeedDays(30)} />
          </Row>
        )}
      </Card>

      <CaptureChart chartId="feeds">
        <Card title={feedTitle}>
          <Text style={styles.meta}>Points: {feedSummary.count}</Text>
          {feedViewMode === 'individual' ? (
            <>
              <Text style={styles.meta}>Total: {feedSummary.total.toFixed(1)} {amountUnit}</Text>
              <Text style={styles.meta}>Average: {feedSummary.average.toFixed(1)} {amountUnit}</Text>
            </>
          ) : (
            <Text style={styles.meta}>Average across points: {feedSummary.average.toFixed(1)} {amountUnit}</Text>
          )}
          {feedChartKind === 'bar' ? (
            <BarChart data={feedSeries} yMax={feedAxis.yMax} yUnitLabel={amountUnit} xAxisLabel={feedXAxisLabel} />
          ) : (
            <LineChart
              data={feedSeries}
              color="#0ea5e9"
              yMin={feedAxis.yMin}
              yMax={feedAxis.yMax}
              yUnitLabel={amountUnit}
              xAxisLabel={feedXAxisLabel}
            />
          )}
        </Card>
      </CaptureChart>

      <CaptureChart chartId="weight">
        <Card title={`Weight-for-age (${weightUnit})`}>
          {weightOverlay ? (
            <Text style={styles.meta}>
              Estimated latest percentile: ~P{weightOverlay.latestPercentile} (reference P10-P90 band)
            </Text>
          ) : (
            <Text style={styles.emptyText}>Add at least one growth entry to see the chart.</Text>
          )}
          {weightOverlay ? (
            <WeightForAgeChart
              observations={weightPoints.map((point) => ({ x: point.x, y: point.y }))}
              p10={weightOverlay.p10}
              p50={weightOverlay.p50}
              p90={weightOverlay.p90}
              xMax={weightOverlay.xMax}
              yUnitLabel={weightUnit}
            />
          ) : null}
        </Card>
      </CaptureChart>

      <Card title="Care">
        <Text style={styles.title}>Temperature range</Text>
        <Row>
          <SelectPill label="7 days" selected={careDays === 7} onPress={() => setCareDays(7)} />
          <SelectPill label="30 days" selected={careDays === 30} onPress={() => setCareDays(30)} />
        </Row>
      </Card>

      <CaptureChart chartId="care">
        <Card title={`Temperature trend (${tempUnit.toUpperCase()})`}>
          <Text style={styles.meta}>Peak: {peakTemp ? peakTemp.toFixed(1) : '—'} {tempUnit.toUpperCase()}</Text>
          <LineChart data={tempSeries} color="#ef4444" yUnitLabel={tempUnit.toUpperCase()} xAxisLabel="Time" />
        </Card>
      </CaptureChart>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, backgroundColor: '#f5f7fb', gap: 10 },
  title: { fontWeight: '600', marginBottom: 8, marginTop: 4 },
  meta: { color: '#4b5563', fontSize: 12, marginBottom: 4 },
  emptyText: { color: '#64748b', fontSize: 13, marginBottom: 6 },
});
