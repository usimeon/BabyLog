import { MedicationDoseUnit, PoopSize } from '../types/models';

type ParsedBase = {
  timestampIso: string;
  raw: string;
};

export type ParsedVoiceEntry =
  | (ParsedBase & {
      type: 'feed';
      feedType: 'bottle' | 'formula' | 'solids' | 'breast';
      amountMl?: number;
      durationMinutes?: number;
      side: 'left' | 'right' | 'both' | 'none';
      notes?: string;
    })
  | (ParsedBase & {
      type: 'measurement';
      weightKg: number;
      notes?: string;
    })
  | (ParsedBase & {
      type: 'temperature';
      temperatureC: number;
      notes?: string;
    })
  | (ParsedBase & {
      type: 'diaper';
      hadPee: boolean;
      hadPoop: boolean;
      poopSize: PoopSize | null;
      notes?: string;
    })
  | (ParsedBase & {
      type: 'medication';
      medicationName: string;
      doseValue: number;
      doseUnit: MedicationDoseUnit;
      minIntervalHours?: number;
      notes?: string;
    })
  | (ParsedBase & {
      type: 'milestone';
      title: string;
      notes?: string;
    });

const clampToIso = () => new Date().toISOString();

const normalize = (input: string) => input.trim().toLowerCase();

const parseNumber = (raw?: string | null) => {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

export const parseVoiceEntry = (input: string): ParsedVoiceEntry | null => {
  const normalized = normalize(input);
  if (!normalized) return null;

  const timestampIso = clampToIso();

  const feedMatch = normalized.match(/(bottle|formula|solids|breast)(?:\s+feed)?(?:\s+([\d.]+)\s*(ml|oz))?(?:.*?([\d.]+)\s*(min|minutes))?/);
  if (feedMatch) {
    const feedType = feedMatch[1] as 'bottle' | 'formula' | 'solids' | 'breast';
    const amountRaw = parseNumber(feedMatch[2]);
    const amountUnit = feedMatch[3];
    const durationRaw = parseNumber(feedMatch[4]);
    const amountMl = amountRaw
      ? amountUnit === 'oz'
        ? amountRaw * 29.5735
        : amountRaw
      : undefined;

    let side: 'left' | 'right' | 'both' | 'none' = 'none';
    if (normalized.includes('left')) side = 'left';
    if (normalized.includes('right')) side = side === 'left' ? 'both' : 'right';

    return {
      type: 'feed',
      timestampIso,
      raw: input,
      feedType,
      amountMl,
      durationMinutes: durationRaw ?? undefined,
      side,
      notes: input,
    };
  }

  const weightMatch = normalized.match(/(?:weight|weighed?)\s*([\d.]+)\s*(kg|lb|lbs)?/);
  if (weightMatch) {
    const value = parseNumber(weightMatch[1]);
    if (value) {
      const unit = weightMatch[2] ?? 'lb';
      const weightKg = unit.startsWith('lb') ? value * 0.45359237 : value;
      return {
        type: 'measurement',
        timestampIso,
        raw: input,
        weightKg,
        notes: input,
      };
    }
  }

  const tempMatch = normalized.match(/(?:temp|temperature)\s*([\d.]+)\s*(c|f)?/);
  if (tempMatch) {
    const value = parseNumber(tempMatch[1]);
    if (value) {
      const unit = tempMatch[2] ?? 'f';
      const temperatureC = unit === 'f' ? ((value - 32) * 5) / 9 : value;
      return {
        type: 'temperature',
        timestampIso,
        raw: input,
        temperatureC,
        notes: input,
      };
    }
  }

  if (normalized.includes('pee') || normalized.includes('poop') || normalized.includes('diaper')) {
    const hadPee = normalized.includes('pee');
    const hadPoop = normalized.includes('poop');
    let poopSize: PoopSize | null = null;
    if (normalized.includes('small')) poopSize = 'small';
    if (normalized.includes('medium')) poopSize = 'medium';
    if (normalized.includes('large')) poopSize = 'large';
    return {
      type: 'diaper',
      timestampIso,
      raw: input,
      hadPee,
      hadPoop,
      poopSize: hadPoop ? poopSize ?? 'small' : null,
      notes: input,
    };
  }

  const medMatch = normalized.match(/(?:med|medicine|medication)\s+([a-z0-9\s-]+?)\s+([\d.]+)\s*(ml|mg|drops|tablet)/);
  if (medMatch) {
    const doseValue = parseNumber(medMatch[2]);
    if (doseValue) {
      const intervalMatch = normalized.match(/(?:every|min)\s*([\d.]+)\s*h/);
      const minIntervalHours = parseNumber(intervalMatch?.[1] ?? null) ?? undefined;
      return {
        type: 'medication',
        timestampIso,
        raw: input,
        medicationName: medMatch[1].trim(),
        doseValue,
        doseUnit: medMatch[3] as MedicationDoseUnit,
        minIntervalHours,
        notes: input,
      };
    }
  }

  if (normalized.includes('milestone') || normalized.startsWith('first ') || normalized.includes('first')) {
    const title = input.replace(/milestone[:\s-]*/i, '').trim();
    return {
      type: 'milestone',
      timestampIso,
      raw: input,
      title: title || 'Milestone',
      notes: input,
    };
  }

  return null;
};
