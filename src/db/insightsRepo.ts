import { getAll } from './client';
import { startOfDay } from '../utils/time';

export type WeeklyInsights = {
  avgFeedsPerDay: number;
  avgDiapersPerDay: number;
  avgTempsPerDay: number;
  feedStreakDays: number;
};

const toDayKey = (date: Date) => date.toISOString().slice(0, 10);

const buildDaySeries = (days: number) => {
  const keys: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = startOfDay(new Date(now));
    d.setDate(d.getDate() - i);
    keys.push(toDayKey(d));
  }
  return keys;
};

const toCountMap = (rows: Array<{ day: string; count: number }>) => {
  const map = new Map<string, number>();
  rows.forEach((row) => map.set(row.day, Number(row.count) || 0));
  return map;
};

export const getWeeklyInsights = async (babyId: string): Promise<WeeklyInsights> => {
  const start7 = startOfDay(new Date());
  start7.setDate(start7.getDate() - 6);

  const start30 = startOfDay(new Date());
  start30.setDate(start30.getDate() - 29);

  const [feed7, diaper7, temp7, feed30] = await Promise.all([
    getAll<{ day: string; count: number }>(
      `SELECT substr(timestamp, 1, 10) AS day, COUNT(*) AS count
       FROM feed_events
       WHERE baby_id = ? AND deleted_at IS NULL AND timestamp >= ?
       GROUP BY day
       ORDER BY day ASC;`,
      [babyId, start7.toISOString()],
    ),
    getAll<{ day: string; count: number }>(
      `SELECT substr(timestamp, 1, 10) AS day, COUNT(*) AS count
       FROM diaper_logs
       WHERE baby_id = ? AND deleted_at IS NULL AND timestamp >= ?
       GROUP BY day
       ORDER BY day ASC;`,
      [babyId, start7.toISOString()],
    ),
    getAll<{ day: string; count: number }>(
      `SELECT substr(timestamp, 1, 10) AS day, COUNT(*) AS count
       FROM temperature_logs
       WHERE baby_id = ? AND deleted_at IS NULL AND timestamp >= ?
       GROUP BY day
       ORDER BY day ASC;`,
      [babyId, start7.toISOString()],
    ),
    getAll<{ day: string; count: number }>(
      `SELECT substr(timestamp, 1, 10) AS day, COUNT(*) AS count
       FROM feed_events
       WHERE baby_id = ? AND deleted_at IS NULL AND timestamp >= ?
       GROUP BY day
       ORDER BY day DESC;`,
      [babyId, start30.toISOString()],
    ),
  ]);

  const days7 = buildDaySeries(7);
  const feedMap7 = toCountMap(feed7);
  const diaperMap7 = toCountMap(diaper7);
  const tempMap7 = toCountMap(temp7);

  const feedTotal = days7.reduce((sum, day) => sum + (feedMap7.get(day) ?? 0), 0);
  const diaperTotal = days7.reduce((sum, day) => sum + (diaperMap7.get(day) ?? 0), 0);
  const tempTotal = days7.reduce((sum, day) => sum + (tempMap7.get(day) ?? 0), 0);

  const feedMap30 = toCountMap(feed30);
  let streak = 0;
  for (let i = 0; i < 30; i += 1) {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - i);
    const key = toDayKey(d);
    if ((feedMap30.get(key) ?? 0) > 0) {
      streak += 1;
    } else {
      break;
    }
  }

  return {
    avgFeedsPerDay: feedTotal / 7,
    avgDiapersPerDay: diaperTotal / 7,
    avgTempsPerDay: tempTotal / 7,
    feedStreakDays: streak,
  };
};
