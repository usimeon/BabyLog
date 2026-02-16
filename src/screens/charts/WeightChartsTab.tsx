import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { LineChart } from '../../components/LineChart';
import { Button, Card } from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { listMeasurements } from '../../db/measurementRepo';
import { exportChartImage } from '../../services/exports';
import { presetDateRange } from '../../utils/dateRange';
import { CaptureChart } from '../../components/CaptureChart';
import { kgToDisplay } from '../../utils/units';
import { estimateWeightPercentile, percentileBandForMonth } from '../../utils/growthPercentiles';

export const WeightChartsTab = () => {
  const { babyId, weightUnit, dataVersion } = useAppContext();
  const [points, setPoints] = useState<Array<{ x: string; y: number }>>([]);
  const [pointsKg, setPointsKg] = useState<Array<{ x: string; y: number }>>([]);

  const load = async () => {
    const rows = await listMeasurements(babyId);
    const ordered = [...rows].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    setPoints(ordered.map((x) => ({ x: x.timestamp, y: kgToDisplay(x.weight_kg, weightUnit) })));
    setPointsKg(ordered.map((x) => ({ x: x.timestamp, y: x.weight_kg })));
  };

  useEffect(() => {
    load();
  }, [babyId, weightUnit, dataVersion]);

  const onExportImage = async () => {
    try {
      await exportChartImage('weight', presetDateRange('30d'));
    } catch (error: any) {
      Alert.alert('Export failed', error?.message ?? 'Unable to export chart image');
    }
  };

  const percentileOverlay = useMemo(() => {
    if (!pointsKg.length) return null;
    const firstTs = new Date(pointsKg[0].x).getTime();
    const withMonth = pointsKg.map((point) => ({
      x: point.x,
      month: Math.max(0, (new Date(point.x).getTime() - firstTs) / (30.44 * 24 * 60 * 60 * 1000)),
      yKg: point.y,
    }));
    const p10 = withMonth.map((p) => ({ x: p.x, y: kgToDisplay(percentileBandForMonth(p.month).p10, weightUnit) }));
    const p50 = withMonth.map((p) => ({ x: p.x, y: kgToDisplay(percentileBandForMonth(p.month).p50, weightUnit) }));
    const p90 = withMonth.map((p) => ({ x: p.x, y: kgToDisplay(percentileBandForMonth(p.month).p90, weightUnit) }));

    const latest = withMonth[withMonth.length - 1];
    const latestPercentile = estimateWeightPercentile(latest.month, latest.yKg);
    return { p10, p50, p90, latestPercentile };
  }, [pointsKg, weightUnit]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <CaptureChart chartId="weight">
        <Card title={`Weight over time (${weightUnit})`}>
          {percentileOverlay ? (
            <Text style={styles.meta}>Estimated latest percentile: ~P{percentileOverlay.latestPercentile}</Text>
          ) : null}
          <LineChart data={points} color="#a855f7" />
          {percentileOverlay ? (
            <>
              <Text style={styles.meta}>Reference overlay</Text>
              <LineChart data={percentileOverlay.p10} color="#93c5fd" />
              <LineChart data={percentileOverlay.p50} color="#60a5fa" />
              <LineChart data={percentileOverlay.p90} color="#F77575" />
            </>
          ) : null}
        </Card>
      </CaptureChart>

      <Button title="Export Weight Chart (PNG)" onPress={onExportImage} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, backgroundColor: '#f5f7fb', gap: 10 },
  meta: { color: '#475569', fontSize: 12, marginBottom: 6 },
});
