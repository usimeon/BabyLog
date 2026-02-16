import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { LineChart } from '../../components/LineChart';
import { Button, Card } from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { listMeasurements } from '../../db/measurementRepo';
import { exportChartImage } from '../../services/exports';
import { presetDateRange } from '../../utils/dateRange';
import { CaptureChart } from '../../components/CaptureChart';
import { kgToDisplay } from '../../utils/units';

export const WeightChartsTab = () => {
  const { babyId, weightUnit, dataVersion } = useAppContext();
  const [points, setPoints] = useState<Array<{ x: string; y: number }>>([]);

  const load = async () => {
    const rows = await listMeasurements(babyId);
    const ordered = [...rows].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    setPoints(ordered.map((x) => ({ x: x.timestamp, y: kgToDisplay(x.weight_kg, weightUnit) })));
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

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <CaptureChart chartId="weight">
        <Card title={`Weight over time (${weightUnit})`}>
          <LineChart data={points} color="#a855f7" />
        </Card>
      </CaptureChart>

      <Button title="Export Weight Chart (PNG)" onPress={onExportImage} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, backgroundColor: '#f5f7fb', gap: 10 },
});
