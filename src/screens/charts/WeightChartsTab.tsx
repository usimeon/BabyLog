import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { WeightForAgeChart } from '../../components/WeightForAgeChart';
import { Button, Card } from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { listMeasurements } from '../../db/measurementRepo';
import { getBabyById } from '../../db/babyRepo';
import { exportChartImage } from '../../services/exports';
import { presetDateRange } from '../../utils/dateRange';
import { CaptureChart } from '../../components/CaptureChart';
import { kgToDisplay } from '../../utils/units';
import { estimateWeightPercentile, percentileBandForMonth } from '../../utils/growthPercentiles';

export const WeightChartsTab = () => {
  const { babyId, weightUnit, dataVersion } = useAppContext();
  const [observations, setObservations] = useState<Array<{ x: number; y: number; yKg: number }>>([]);

  const load = async () => {
    const [rows, baby] = await Promise.all([listMeasurements(babyId), getBabyById(babyId)]);
    const ordered = [...rows].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    if (!ordered.length) {
      setObservations([]);
      return;
    }
    const baseMs = baby?.birthdate ? new Date(baby.birthdate).getTime() : new Date(ordered[0].timestamp).getTime();
    const next = ordered.map((row) => {
      const ageMonths = Math.max(0, (new Date(row.timestamp).getTime() - baseMs) / (30.44 * 24 * 60 * 60 * 1000));
      return { x: ageMonths, y: kgToDisplay(row.weight_kg, weightUnit), yKg: row.weight_kg };
    });
    setObservations(next);
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
    if (!observations.length) return null;
    const latestMonth = observations[observations.length - 1].x;
    const xMax = Math.max(24, Math.ceil(latestMonth / 2) * 2);
    const months = Array.from({ length: xMax + 1 }, (_, month) => month);
    const p10 = months.map((month) => ({ x: month, y: kgToDisplay(percentileBandForMonth(month).p10, weightUnit) }));
    const p50 = months.map((month) => ({ x: month, y: kgToDisplay(percentileBandForMonth(month).p50, weightUnit) }));
    const p90 = months.map((month) => ({ x: month, y: kgToDisplay(percentileBandForMonth(month).p90, weightUnit) }));
    const latest = observations[observations.length - 1];
    const latestPercentile = estimateWeightPercentile(latest.x, latest.yKg);
    return { p10, p50, p90, latestPercentile, xMax };
  }, [observations, weightUnit]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <CaptureChart chartId="weight">
        <Card title={`Weight-for-age (${weightUnit})`}>
          {percentileOverlay ? (
            <Text style={styles.meta}>
              Estimated latest percentile: ~P{percentileOverlay.latestPercentile} (reference P10-P90 band)
            </Text>
          ) : null}
          {percentileOverlay ? (
            <WeightForAgeChart
              observations={observations.map((point) => ({ x: point.x, y: point.y }))}
              p10={percentileOverlay.p10}
              p50={percentileOverlay.p50}
              p90={percentileOverlay.p90}
              xMax={percentileOverlay.xMax}
              yUnitLabel={weightUnit}
            />
          ) : (
            <Text style={styles.emptyText}>Add at least one growth entry to see the chart.</Text>
          )}
        </Card>
      </CaptureChart>

      <Button title="Export Weight Chart (PNG)" onPress={onExportImage} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, backgroundColor: '#f5f7fb', gap: 10 },
  meta: { color: '#475569', fontSize: 12, marginBottom: 6 },
  emptyText: { color: '#64748b', fontSize: 13 },
});
