import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { BarChart } from '../../components/BarChart';
import { LineChart } from '../../components/LineChart';
import { Button, Card, Row, SelectPill } from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { listTemperatureLogs } from '../../db/temperatureRepo';
import { listDiaperLogs } from '../../db/diaperRepo';
import { listMedicationLogs } from '../../db/medicationRepo';
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

const countByDay = (items: Array<{ timestamp: string }>, days: number) => {
  const map = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const item of items) {
    const day = toDay(item.timestamp);
    if (!map.has(day)) continue;
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([x, y]) => ({ x, y }));
};

export const CareChartsTab = () => {
  const { babyId, tempUnit, dataVersion } = useAppContext();
  const [days, setDays] = useState<Days>(7);
  const [tempSeries, setTempSeries] = useState<Array<{ x: string; y: number }>>([]);
  const [diaperCounts, setDiaperCounts] = useState<Array<{ x: string; y: number }>>([]);
  const [medCounts, setMedCounts] = useState<Array<{ x: string; y: number }>>([]);

  useEffect(() => {
    const load = async () => {
      const [temps, diapers, meds] = await Promise.all([
        listTemperatureLogs(babyId),
        listDiaperLogs(babyId),
        listMedicationLogs(babyId),
      ]);

      const tempRows = temps
        .filter((x) => inLastDays(x.timestamp, days))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .map((x) => ({ x: x.timestamp, y: cToDisplay(Number(x.temperature_c), tempUnit) }));

      setTempSeries(tempRows);
      setDiaperCounts(countByDay(diapers.filter((x) => inLastDays(x.timestamp, days)), days));
      setMedCounts(countByDay(meds.filter((x) => inLastDays(x.timestamp, days)), days));
    };

    load();
  }, [babyId, tempUnit, days, dataVersion]);

  const stats = useMemo(() => {
    const maxTemp = tempSeries.length ? Math.max(...tempSeries.map((x) => x.y)) : 0;
    const avgDiapers = diaperCounts.length
      ? diaperCounts.reduce((sum, x) => sum + x.y, 0) / diaperCounts.length
      : 0;
    const totalMeds = medCounts.reduce((sum, x) => sum + x.y, 0);
    return { maxTemp, avgDiapers, totalMeds };
  }, [tempSeries, diaperCounts, medCounts]);

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

        <Card title="Diaper logs per day">
          <Text style={styles.meta}>Average/day: {stats.avgDiapers.toFixed(1)}</Text>
          <BarChart data={diaperCounts} color="#10b981" />
        </Card>

        <Card title="Medication logs per day">
          <Text style={styles.meta}>Total doses: {stats.totalMeds}</Text>
          <BarChart data={medCounts} color="#f59e0b" />
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
