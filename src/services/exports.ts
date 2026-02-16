import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as XLSX from 'xlsx';
import { DateRange } from '../types/models';
import { getOrCreateDefaultBaby } from '../db/babyRepo';
import { diaperRowsForRange } from '../db/diaperRepo';
import { feedRowsForRange } from '../db/feedRepo';
import { measurementRowsForRange } from '../db/measurementRepo';
import { temperatureRowsForRange } from '../db/temperatureRepo';
import { getChartRef } from './chartCaptureRegistry';

const fileNameDatePart = () => new Date().toISOString().replace(/[:.]/g, '-');

const ensureShareAvailable = async (uri: string) => {
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri);
};

export const exportChartImage = async (chartId: string, dateRange: DateRange) => {
  const chartRef = getChartRef(chartId);
  if (!chartRef?.current) {
    throw new Error(`Chart ${chartId} is not mounted yet.`);
  }

  const tempUri = await captureRef(chartRef, {
    format: 'png',
    quality: 1,
  });

  const targetUri = `${FileSystem.documentDirectory}babylog-chart-${chartId}-${fileNameDatePart()}.png`;
  await FileSystem.copyAsync({ from: tempUri, to: targetUri });
  await ensureShareAvailable(targetUri);

  return targetUri;
};

const toDataUri = async (fileUri: string) => {
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:image/png;base64,${base64}`;
};

const summaryFromFeeds = (rows: Array<{ amount_ml?: number | null; timestamp: string }>) => {
  const totalMl = rows.reduce((sum, row) => sum + (row.amount_ml ?? 0), 0);
  const avgMl = rows.length ? totalMl / rows.length : 0;
  return {
    totalMl,
    avgMl,
    feedsCount: rows.length,
  };
};

export const exportPdf = async (dateRange: DateRange) => {
  const baby = await getOrCreateDefaultBaby();
  const feeds = await feedRowsForRange(baby.id, dateRange.start.toISOString(), dateRange.end.toISOString());
  const measurements = await measurementRowsForRange(
    baby.id,
    dateRange.start.toISOString(),
    dateRange.end.toISOString(),
  );
  const temperatures = await temperatureRowsForRange(
    baby.id,
    dateRange.start.toISOString(),
    dateRange.end.toISOString(),
  );
  const diapers = await diaperRowsForRange(baby.id, dateRange.start.toISOString(), dateRange.end.toISOString());

  const feedImageRef = getChartRef('feeds');
  const weightImageRef = getChartRef('weight');

  let feedChartDataUri = '';
  let weightChartDataUri = '';

  if (feedImageRef?.current) {
    const feedChartUri = await captureRef(feedImageRef, { format: 'png', quality: 1 });
    feedChartDataUri = await toDataUri(feedChartUri);
  }

  if (weightImageRef?.current) {
    const weightChartUri = await captureRef(weightImageRef, { format: 'png', quality: 1 });
    weightChartDataUri = await toDataUri(weightChartUri);
  }

  const summary = summaryFromFeeds(feeds);

  const html = `
    <html>
      <head>
        <style>
          body { font-family: -apple-system, Arial, sans-serif; padding: 24px; }
          h1, h2 { margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
          img { max-width: 100%; margin-bottom: 16px; border: 1px solid #eee; }
        </style>
      </head>
      <body>
        <h1>BabyLog Report</h1>
        <p>Baby: ${baby.name}</p>
        <p>Date range: ${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}</p>

        <h2>Summary</h2>
        <table>
          <tr><th>Feed events</th><td>${summary.feedsCount}</td></tr>
          <tr><th>Total amount (ml)</th><td>${summary.totalMl.toFixed(1)}</td></tr>
          <tr><th>Average amount per feed (ml)</th><td>${summary.avgMl.toFixed(1)}</td></tr>
          <tr><th>Measurements</th><td>${measurements.length}</td></tr>
          <tr><th>Temperature logs</th><td>${temperatures.length}</td></tr>
          <tr><th>Poop/Pee logs</th><td>${diapers.length}</td></tr>
        </table>

        ${feedChartDataUri ? `<h2>Feed chart</h2><img src="${feedChartDataUri}" />` : ''}
        ${weightChartDataUri ? `<h2>Weight chart</h2><img src="${weightChartDataUri}" />` : ''}
      </body>
    </html>
  `;

  const file = await Print.printToFileAsync({ html });
  await ensureShareAvailable(file.uri);
  return file.uri;
};

export const exportExcel = async (dateRange: DateRange) => {
  const baby = await getOrCreateDefaultBaby();
  const feeds = await feedRowsForRange(baby.id, dateRange.start.toISOString(), dateRange.end.toISOString());
  const measurements = await measurementRowsForRange(
    baby.id,
    dateRange.start.toISOString(),
    dateRange.end.toISOString(),
  );
  const temperatures = await temperatureRowsForRange(
    baby.id,
    dateRange.start.toISOString(),
    dateRange.end.toISOString(),
  );
  const diapers = await diaperRowsForRange(baby.id, dateRange.start.toISOString(), dateRange.end.toISOString());

  const dailySummaryMap = new Map<string, number>();
  feeds.forEach((feed) => {
    const day = feed.timestamp.slice(0, 10);
    const existing = dailySummaryMap.get(day) ?? 0;
    dailySummaryMap.set(day, existing + (feed.amount_ml ?? 0));
  });

  const wb = XLSX.utils.book_new();

  const feedData = feeds.map((f) => ({
    id: f.id,
    timestamp: f.timestamp,
    type: f.type,
    amount_ml: f.amount_ml ?? '',
    duration_minutes: f.duration_minutes ?? '',
    side: f.side,
    notes: f.notes ?? '',
  }));

  const measurementData = measurements.map((m) => ({
    id: m.id,
    timestamp: m.timestamp,
    weight_kg: m.weight_kg,
    length_cm: m.length_cm ?? '',
    head_circumference_cm: m.head_circumference_cm ?? '',
    notes: m.notes ?? '',
  }));

  const dailySummaryData = Array.from(dailySummaryMap.entries()).map(([day, totalMl]) => ({
    day,
    total_ml: Number(totalMl.toFixed(2)),
  }));

  const temperatureData = temperatures.map((t) => ({
    id: t.id,
    timestamp: t.timestamp,
    temperature_c: t.temperature_c,
    notes: t.notes ?? '',
  }));

  const diaperData = diapers.map((d) => ({
    id: d.id,
    timestamp: d.timestamp,
    had_pee: d.had_pee ? 1 : 0,
    had_poop: d.had_poop ? 1 : 0,
    poop_size: d.poop_size ?? '',
    notes: d.notes ?? '',
  }));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(feedData), 'FeedEvents');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(measurementData), 'Measurements');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(temperatureData), 'TemperatureLogs');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(diaperData), 'DiaperLogs');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailySummaryData), 'DailySummary');

  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const uri = `${FileSystem.documentDirectory}babylog-export-${fileNameDatePart()}.xlsx`;

  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await ensureShareAvailable(uri);
  return uri;
};
