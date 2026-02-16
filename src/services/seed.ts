import { addFeed } from '../db/feedRepo';
import { addMeasurement } from '../db/measurementRepo';
import { runSql } from '../db/client';

export const clearDemoData = async (babyId: string) => {
  await runSql('DELETE FROM feed_events WHERE baby_id = ?;', [babyId]);
  await runSql('DELETE FROM measurements WHERE baby_id = ?;', [babyId]);
};

export const seedDemoData = async (babyId: string) => {
  const now = new Date();

  for (let i = 0; i < 12; i += 1) {
    const at = new Date(now.getTime() - i * 3 * 60 * 60 * 1000);
    await addFeed(babyId, {
      timestamp: at.toISOString(),
      type: i % 2 === 0 ? 'bottle' : 'breast',
      amount_ml: i % 2 === 0 ? 80 + i * 4 : null,
      duration_minutes: i % 2 === 1 ? 12 + (i % 4) * 2 : null,
      side: i % 2 === 1 ? (i % 3 === 0 ? 'left' : 'right') : 'none',
      notes: i === 0 ? 'Most recent feed' : null,
    });
  }

  for (let i = 0; i < 10; i += 1) {
    const at = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    await addMeasurement(babyId, {
      timestamp: at.toISOString(),
      weight_kg: 3.2 + i * 0.16,
      length_cm: 51 + i * 0.7,
      head_circumference_cm: 34 + i * 0.3,
      notes: i === 0 ? 'Latest check' : null,
    });
  }
};

