import { describe, expect, it } from 'vitest';
import { averageIntervalHoursFromTimestamps, intervalTrendPointsFromAscending } from './feedAnalytics';

describe('feed analytics helpers', () => {
  it('computes average interval hours from descending timestamps', () => {
    const ts = [
      '2026-02-16T12:00:00.000Z',
      '2026-02-16T09:00:00.000Z',
      '2026-02-16T06:00:00.000Z',
    ];

    expect(averageIntervalHoursFromTimestamps(ts)).toBeCloseTo(3, 5);
  });

  it('returns 0 average interval when fewer than two points', () => {
    expect(averageIntervalHoursFromTimestamps([])).toBe(0);
    expect(averageIntervalHoursFromTimestamps(['2026-02-16T12:00:00.000Z'])).toBe(0);
  });

  it('builds interval trend points from ascending timestamps', () => {
    const ts = [
      '2026-02-16T06:00:00.000Z',
      '2026-02-16T08:30:00.000Z',
      '2026-02-16T11:00:00.000Z',
    ];

    const points = intervalTrendPointsFromAscending(ts);
    expect(points).toHaveLength(2);
    expect(points[0].x).toBe('2026-02-16T08:30:00.000Z');
    expect(points[0].hours).toBeCloseTo(2.5, 5);
    expect(points[1].hours).toBeCloseTo(2.5, 5);
  });
});
