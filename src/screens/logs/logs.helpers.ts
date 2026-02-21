import { DiaperLog, FeedEvent, Measurement, MedicationLog, Milestone, TemperatureLog } from '../../types/models';
import { startOfDay } from '../../utils/time';
import { cToDisplay, formatAmount, formatTemp, formatWeight } from '../../utils/units';
import { GlanceStats, LogEntry, LogFilter, RangePreset } from './logs.types';

type BuildLogEntriesInput = {
  feeds: FeedEvent[];
  measurements: Measurement[];
  temps: TemperatureLog[];
  diapers: DiaperLog[];
  medications: MedicationLog[];
  milestones: Milestone[];
  amountUnit: 'ml' | 'oz';
  weightUnit: 'kg' | 'lb';
  tempUnit: 'c' | 'f';
};

export const buildLogEntries = ({
  feeds,
  measurements,
  temps,
  diapers,
  medications,
  milestones,
  amountUnit,
  weightUnit,
  tempUnit,
}: BuildLogEntriesInput): LogEntry[] =>
  [
    ...feeds.map((item) => ({
      id: item.id,
      kind: 'feed' as const,
      timestamp: item.timestamp,
      title: `Feed • ${item.type}`,
      subtitle: `${formatAmount(item.amount_ml, item.type === 'solids' ? 'oz' : amountUnit)} • ${item.duration_minutes ?? 0} min • ${item.side}`,
      notes: item.notes,
    })),
    ...measurements.map((item) => ({
      id: item.id,
      kind: 'measurement' as const,
      timestamp: item.timestamp,
      title: `Growth • ${formatWeight(item.weight_kg, weightUnit)}`,
      subtitle: `Length ${item.length_cm ?? '—'} cm • Head ${item.head_circumference_cm ?? '—'} cm`,
      notes: item.notes,
    })),
    ...temps.map((item) => ({
      id: item.id,
      kind: 'temperature' as const,
      timestamp: item.timestamp,
      title: `Temp • ${formatTemp(Number(item.temperature_c), tempUnit)}`,
      subtitle: 'Temperature check',
      notes: item.notes,
    })),
    ...diapers.map((item) => ({
      id: item.id,
      kind: 'diaper' as const,
      timestamp: item.timestamp,
      title: 'Diaper',
      subtitle: `${item.had_pee ? 'pee' : ''}${item.had_pee && item.had_poop ? ' + ' : ''}${item.had_poop ? `poop (${item.poop_size ?? 'small'})` : ''}`,
      notes: item.notes,
    })),
    ...medications.map((item) => ({
      id: item.id,
      kind: 'medication' as const,
      timestamp: item.timestamp,
      title: `Medication • ${item.medication_name}`,
      subtitle: `${item.dose_value} ${item.dose_unit}${item.min_interval_hours ? ` • min ${item.min_interval_hours}h` : ''}`,
      notes: item.notes,
    })),
    ...milestones.map((item) => ({
      id: item.id,
      kind: 'milestone' as const,
      timestamp: item.timestamp,
      title: `Milestone • ${item.title}`,
      subtitle: item.photo_uri ? 'Photo attached' : 'Milestone note',
      notes: item.notes,
    })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

export const buildGlanceStats = (feeds: FeedEvent[], diapers: DiaperLog[], temps: TemperatureLog[], entries: LogEntry[], tempUnit: 'c' | 'f'): GlanceStats => {
  const dayStart = startOfDay(new Date()).getTime();
  return {
    feedsToday: feeds.filter((x) => new Date(x.timestamp).getTime() >= dayStart).length,
    diapersToday: diapers.filter((x) => new Date(x.timestamp).getTime() >= dayStart).length,
    latestTemp: temps.length ? cToDisplay(Number(temps[0].temperature_c), tempUnit).toFixed(1) : '—',
    entriesToday: entries.filter((x) => new Date(x.timestamp).getTime() >= dayStart).length,
  };
};

type FilterVisibleEntriesInput = {
  entries: LogEntry[];
  filter: LogFilter;
  search: string;
  rangePreset: RangePreset;
  pinned: string[];
  getEntryKey: (entry: Pick<LogEntry, 'kind' | 'id'>) => string;
};

export const filterVisibleEntries = ({ entries, filter, search, rangePreset, pinned, getEntryKey }: FilterVisibleEntriesInput): LogEntry[] => {
  const now = new Date();
  const dayStart = startOfDay(now).getTime();
  const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  const byRange = entries.filter((x) => {
    const ts = new Date(x.timestamp).getTime();
    if (rangePreset === 'today') return ts >= dayStart;
    if (rangePreset === '7d') return ts >= sevenDaysAgo;
    if (rangePreset === '30d') return ts >= thirtyDaysAgo;
    return true;
  });

  let typed: LogEntry[] = byRange;
  if (filter === 'pinned') {
    typed = byRange.filter((x) => pinned.includes(getEntryKey(x)));
  } else if (filter !== 'all') {
    typed = byRange.filter((x) => x.kind === filter);
  }

  const query = search.trim().toLowerCase();
  if (!query) return typed;

  return typed.filter((x) => {
    const text = `${x.kind} ${x.title} ${x.subtitle} ${x.notes ?? ''}`.toLowerCase();
    return text.includes(query);
  });
};

export const countFilteredKinds = (visibleEntries: LogEntry[]) => {
  const counts = {
    feed: 0,
    measurement: 0,
    temperature: 0,
    diaper: 0,
    medication: 0,
    milestone: 0,
  };
  for (const item of visibleEntries) counts[item.kind] += 1;
  return counts;
};
