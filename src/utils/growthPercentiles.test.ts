import { describe, expect, it } from 'vitest';
import { estimateWeightPercentile, percentileBandForMonth } from './growthPercentiles';

describe('growthPercentiles', () => {
  it('returns ordered percentile band', () => {
    const band = percentileBandForMonth(6);
    expect(band.p10).toBeLessThan(band.p50);
    expect(band.p50).toBeLessThan(band.p90);
  });

  it('estimates percentile near median for median-ish weight', () => {
    const p = estimateWeightPercentile(6, 7.3);
    expect(p).toBeGreaterThanOrEqual(45);
    expect(p).toBeLessThanOrEqual(55);
  });

  it('caps percentile for high weight', () => {
    const p = estimateWeightPercentile(6, 20);
    expect(p).toBe(90);
  });
});
