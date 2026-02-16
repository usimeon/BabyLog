type PercentilePoint = {
  month: number;
  p10: number;
  p50: number;
  p90: number;
};

// Simplified WHO-style reference points (kg) for 0-24 months.
const REFERENCE: PercentilePoint[] = [
  { month: 0, p10: 2.8, p50: 3.3, p90: 4.2 },
  { month: 1, p10: 3.5, p50: 4.2, p90: 5.4 },
  { month: 2, p10: 4.3, p50: 5.1, p90: 6.5 },
  { month: 3, p10: 4.9, p50: 5.8, p90: 7.3 },
  { month: 4, p10: 5.3, p50: 6.4, p90: 7.9 },
  { month: 6, p10: 6.0, p50: 7.3, p90: 8.9 },
  { month: 9, p10: 6.9, p50: 8.4, p90: 10.1 },
  { month: 12, p10: 7.5, p50: 9.3, p90: 11.2 },
  { month: 18, p10: 8.6, p50: 10.9, p90: 13.1 },
  { month: 24, p10: 9.6, p50: 12.2, p90: 14.6 },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const boundsForMonth = (month: number) => {
  const clamped = Math.max(REFERENCE[0].month, Math.min(REFERENCE[REFERENCE.length - 1].month, month));
  let left = REFERENCE[0];
  let right = REFERENCE[REFERENCE.length - 1];

  for (let i = 0; i < REFERENCE.length - 1; i += 1) {
    const current = REFERENCE[i];
    const next = REFERENCE[i + 1];
    if (clamped >= current.month && clamped <= next.month) {
      left = current;
      right = next;
      break;
    }
  }

  const span = right.month - left.month || 1;
  const t = (clamped - left.month) / span;
  return { left, right, t };
};

export const percentileBandForMonth = (month: number) => {
  const { left, right, t } = boundsForMonth(month);
  return {
    p10: lerp(left.p10, right.p10, t),
    p50: lerp(left.p50, right.p50, t),
    p90: lerp(left.p90, right.p90, t),
  };
};

export const estimateWeightPercentile = (month: number, weightKg: number) => {
  const band = percentileBandForMonth(month);
  if (weightKg <= band.p10) return 10;
  if (weightKg >= band.p90) return 90;
  if (weightKg <= band.p50) {
    const t = (weightKg - band.p10) / (band.p50 - band.p10 || 1);
    return Math.round(10 + t * 40);
  }
  const t = (weightKg - band.p50) / (band.p90 - band.p50 || 1);
  return Math.round(50 + t * 40);
};

export const percentileReferenceSeries = (months: number[]) => {
  return {
    p10: months.map((m) => ({ x: `m${m}`, y: percentileBandForMonth(m).p10 })),
    p50: months.map((m) => ({ x: `m${m}`, y: percentileBandForMonth(m).p50 })),
    p90: months.map((m) => ({ x: `m${m}`, y: percentileBandForMonth(m).p90 })),
  };
};
