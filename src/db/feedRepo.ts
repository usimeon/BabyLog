import { FeedEvent, FeedSummary } from '../types/models';
import { createId } from '../utils/id';
import { addHours, endOfDay, nowIso, startOfDay } from '../utils/time';
import { getAll, getOne, runSql } from './client';
import { averageIntervalHoursFromTimestamps, intervalTrendPointsFromAscending } from './feedAnalytics';

export type FeedInput = {
  timestamp: string;
  type: FeedEvent['type'];
  amount_ml?: number | null;
  duration_minutes?: number | null;
  side: FeedEvent['side'];
  notes?: string | null;
};

export const addFeed = async (babyId: string, input: FeedInput) => {
  const now = nowIso();
  const id = createId('feed');
  await runSql(
    `INSERT INTO feed_events(
      id, baby_id, timestamp, type, amount_ml, duration_minutes, side, notes,
      created_at, updated_at, deleted_at, dirty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1);`,
    [
      id,
      babyId,
      input.timestamp,
      input.type,
      input.amount_ml ?? null,
      input.duration_minutes ?? null,
      input.side,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return getFeedById(id);
};

export const updateFeed = async (id: string, input: FeedInput) => {
  const now = nowIso();
  await runSql(
    `UPDATE feed_events
     SET timestamp = ?, type = ?, amount_ml = ?, duration_minutes = ?, side = ?, notes = ?, updated_at = ?, dirty = 1
     WHERE id = ?;`,
    [
      input.timestamp,
      input.type,
      input.amount_ml ?? null,
      input.duration_minutes ?? null,
      input.side,
      input.notes ?? null,
      now,
      id,
    ],
  );

  return getFeedById(id);
};

export const softDeleteFeed = async (id: string) => {
  const now = nowIso();
  await runSql('UPDATE feed_events SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;', [now, now, id]);
};

export const getFeedById = async (id: string) => {
  return getOne<FeedEvent>('SELECT * FROM feed_events WHERE id = ? LIMIT 1;', [id]);
};

export const listFeeds = async (babyId: string, options?: { type?: string; from?: string; to?: string }) => {
  const params: Array<string | number> = [babyId];
  let where = 'baby_id = ? AND deleted_at IS NULL';

  if (options?.type && options.type !== 'all') {
    where += ' AND type = ?';
    params.push(options.type);
  }

  if (options?.from) {
    where += ' AND timestamp >= ?';
    params.push(options.from);
  }

  if (options?.to) {
    where += ' AND timestamp <= ?';
    params.push(options.to);
  }

  return getAll<FeedEvent>(`SELECT * FROM feed_events WHERE ${where} ORDER BY timestamp DESC;`, params);
};

export const getLastFeed = async (babyId: string) => {
  return getOne<FeedEvent>(
    'SELECT * FROM feed_events WHERE baby_id = ? AND deleted_at IS NULL ORDER BY timestamp DESC LIMIT 1;',
    [babyId],
  );
};

export const calculateFeedSummary = async (
  babyId: string,
  reminderIntervalHours: number,
): Promise<FeedSummary> => {
  const lastFeed = await getLastFeed(babyId);

  const todayStart = startOfDay(new Date()).toISOString();
  const todayEnd = endOfDay(new Date()).toISOString();

  const todayTotals = await getOne<{ total: number }>(
    `SELECT COALESCE(SUM(amount_ml), 0) AS total
     FROM feed_events
     WHERE baby_id = ?
       AND deleted_at IS NULL
       AND type IN ('bottle', 'formula')
       AND timestamp BETWEEN ? AND ?;`,
    [babyId, todayStart, todayEnd],
  );

  const recentFeeds = await getAll<Pick<FeedEvent, 'timestamp'>>(
    `SELECT timestamp
     FROM feed_events
     WHERE baby_id = ?
       AND deleted_at IS NULL
       AND timestamp >= ?
     ORDER BY timestamp DESC
     LIMIT 20;`,
    [babyId, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()],
  );

  const avgInterval = averageIntervalHoursFromTimestamps(recentFeeds.map((x) => x.timestamp));

  return {
    lastFeedTime: lastFeed?.timestamp,
    nextReminderTime: lastFeed?.timestamp ? addHours(lastFeed.timestamp, reminderIntervalHours) : undefined,
    totalAmountTodayMl: todayTotals?.total ?? 0,
    averageIntervalHours: avgInterval,
  };
};

export const dailyFeedTotals = async (babyId: string, days: number) => {
  const start = startOfDay(new Date());
  start.setDate(start.getDate() - (days - 1));

  return getAll<{ day: string; total_ml: number }>(
    `SELECT substr(timestamp, 1, 10) AS day, COALESCE(SUM(amount_ml), 0) AS total_ml
     FROM feed_events
     WHERE baby_id = ?
       AND deleted_at IS NULL
       AND type IN ('bottle', 'formula')
       AND timestamp >= ?
     GROUP BY day
     ORDER BY day ASC;`,
    [babyId, start.toISOString()],
  );
};

export const monthlyFeedTotals = async (babyId: string, months: number) => {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - (months - 1));

  return getAll<{ month: string; total_ml: number }>(
    `SELECT substr(timestamp, 1, 7) AS month, COALESCE(SUM(amount_ml), 0) AS total_ml
     FROM feed_events
     WHERE baby_id = ?
       AND deleted_at IS NULL
       AND type IN ('bottle', 'formula')
       AND amount_ml IS NOT NULL
       AND timestamp >= ?
     GROUP BY month
     ORDER BY month ASC;`,
    [babyId, start.toISOString()],
  );
};

export const individualFeedAmounts = async (babyId: string, days: number) => {
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return getAll<Pick<FeedEvent, 'timestamp' | 'amount_ml' | 'type'>>(
    `SELECT timestamp, amount_ml, type
     FROM feed_events
     WHERE baby_id = ?
       AND deleted_at IS NULL
       AND amount_ml IS NOT NULL
       AND type IN ('bottle', 'formula')
       AND timestamp >= ?
     ORDER BY timestamp ASC;`,
    [babyId, start],
  );
};

export const intervalTrend = async (babyId: string, days: number) => {
  const feeds = await getAll<Pick<FeedEvent, 'timestamp'>>(
    `SELECT timestamp
     FROM feed_events
     WHERE baby_id = ? AND deleted_at IS NULL AND timestamp >= ?
     ORDER BY timestamp ASC;`,
    [babyId, new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()],
  );

  return intervalTrendPointsFromAscending(feeds.map((x) => x.timestamp));
};

export const feedRowsForRange = async (babyId: string, from: string, to: string) => {
  return getAll<FeedEvent>(
    `SELECT * FROM feed_events
     WHERE baby_id = ? AND deleted_at IS NULL AND timestamp BETWEEN ? AND ?
     ORDER BY timestamp ASC;`,
    [babyId, from, to],
  );
};
