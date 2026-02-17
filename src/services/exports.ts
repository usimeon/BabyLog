import { DateRange } from '../types/models';

export type ExportKind = 'feed' | 'measurement' | 'temperature' | 'diaper' | 'medication' | 'milestone';
type ExportOptions = { kinds?: ExportKind[]; share?: boolean };

export const exportChartImage = async (_chartId: string, _dateRange: DateRange) => {
  throw new Error('PNG export is disabled in this lightweight build.');
};

export const exportPdf = async (_dateRange: DateRange, _options?: ExportOptions) => {
  throw new Error('PDF export is disabled in this lightweight build.');
};

export const exportExcel = async (_dateRange: DateRange, _options?: ExportOptions) => {
  throw new Error('Excel export is disabled in this lightweight build.');
};
