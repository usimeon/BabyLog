export type FeedType = 'breast' | 'bottle' | 'formula' | 'solids';
export type FeedSide = 'left' | 'right' | 'both' | 'none';

export type AmountUnit = 'ml' | 'oz';
export type WeightUnit = 'kg' | 'lb';
export type TemperatureUnit = 'c' | 'f';
export type PoopSize = 'small' | 'medium' | 'large';

export interface BabyProfile {
  id: string;
  name: string;
  birthdate?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  dirty: number;
}

export interface FeedEvent {
  id: string;
  baby_id: string;
  timestamp: string;
  type: FeedType;
  amount_ml?: number | null;
  duration_minutes?: number | null;
  side: FeedSide;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  dirty: number;
}

export interface Measurement {
  id: string;
  baby_id: string;
  timestamp: string;
  weight_kg: number;
  length_cm?: number | null;
  head_circumference_cm?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  dirty: number;
}

export interface ReminderSettings {
  enabled: boolean;
  intervalHours: number;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  allowDuringQuietHours: boolean;
}

export interface TemperatureLog {
  id: string;
  baby_id: string;
  timestamp: string;
  temperature_c: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  dirty: number;
}

export interface DiaperLog {
  id: string;
  baby_id: string;
  timestamp: string;
  had_pee: number;
  had_poop: number;
  poop_size?: PoopSize | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  dirty: number;
}

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

export interface FeedSummary {
  lastFeedTime?: string;
  nextReminderTime?: string;
  totalAmountTodayMl: number;
  averageIntervalHours: number;
}
