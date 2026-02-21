import { ToastBannerKind } from '../../components/ToastBanner';

export type LogFilter = 'all' | 'pinned' | 'feed' | 'measurement' | 'temperature' | 'diaper' | 'medication' | 'milestone';
export type EntryKind = 'feed' | 'measurement' | 'temperature' | 'diaper' | 'medication' | 'milestone';

export type LogEntry = {
  id: string;
  kind: EntryKind;
  timestamp: string;
  title: string;
  subtitle: string;
  notes?: string | null;
};

export type GlanceStats = {
  feedsToday: number;
  diapersToday: number;
  latestTemp: string;
  entriesToday: number;
};

export type AlertItem = {
  level: 'warning' | 'critical';
  message: string;
};

export type RangePreset = 'today' | '7d' | '30d' | 'all';

export type ToastState = {
  kind: ToastBannerKind;
  message: string;
} | null;

export const filters: LogFilter[] = ['all', 'pinned', 'feed', 'measurement', 'temperature', 'diaper', 'medication', 'milestone'];

export const rangeFilterPills: Array<{ id: RangePreset; label: string }> = [
  { id: 'today', label: 'today' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'all' },
];
