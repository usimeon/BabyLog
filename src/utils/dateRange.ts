import { DateRange } from '../types/models';
import { endOfDay, startOfDay } from './time';

export type DateRangePreset = '7d' | '30d' | 'custom';

export const presetDateRange = (preset: DateRangePreset): DateRange => {
  const end = endOfDay(new Date());
  const start = startOfDay(new Date());

  if (preset === '7d') {
    start.setDate(start.getDate() - 6);
    return { start, end, label: 'Last 7 days' };
  }

  if (preset === '30d') {
    start.setDate(start.getDate() - 29);
    return { start, end, label: 'Last 30 days' };
  }

  return { start, end, label: 'Custom' };
};
