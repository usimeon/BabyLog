import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { LineChart } from '../../components/LineChart';
import { Button, Card, Row, SelectPill } from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { listTemperatureLogs } from '../../db/temperatureRepo';
import { exportChartImage } from '../../services/exports';
import { presetDateRange } from '../../utils/dateRange';
import { cToDisplay } from '../../utils/units';
import { CaptureChart } from '../../components/CaptureChart';

type Days = 7 | 30;

const toDay = (iso: string) => iso.slice(0, 10);

const inLastDays = (iso: string, days: number) => {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(iso).getTime() >= cutoff;
};

export const CareChartsTab = () => {
  const { babyId, tempUnit, dataVersion } = useAppContext();
  const [days, setDays] = useState<Days>(7);
  const [tempSeries, setTempSeries] = useState<Array<{ x: string; y: number }>>([]);

  useEffect(() => {
    const load = async () => {
      const temps = await listTemperatureLogs(babyId);

      const tempRows = temps
        .filter((x) => inLastDays(x.timestamp, days))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .map((x) => ({ x: x.timestamp, y: cToDisplay(Number(x.temperature_c), tempUnit) }));

      setTempSeries(tempRows);
    };

    load();
  }, [babyId, tempUnit, days, dataVersion]);

  const stats = useMemo(() => {
    const maxTemp = tempSeries.length ? Math.max(...tempSeries.map((x) => x.y)) : 0;
    return { maxTemp };
  }, [tempSeries]);

  const onExportImage = async () => {
    try {
      await exportChartImage('care', presetDateRange(days === 7 ? '7d' : '30d'));
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
        </Row>
      </Card>

      <CaptureChart chartId="care">
        <Card title={`Temperature trend (${tempUnit.toUpperCase()})`}>
          <Text style={styles.meta}>Peak: {stats.maxTemp ? stats.maxTemp.toFixed(1) : '—'} {tempUnit.toUpperCase()}</Text>
          <LineChart data={tempSeries} color="#ef4444" />
        </Card>
      </CaptureChart>

      <Button title="Export Care Charts (PNG)" onPress={onExportImage} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, backgroundColor: '#f5f7fb', gap: 10 },
  title: { fontWeight: '600', marginBottom: 8, marginTop: 4 },
  meta: { color: '#4b5563', fontSize: 12, marginBottom: 6 },
});
