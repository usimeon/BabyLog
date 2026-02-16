import { addFeed } from '../db/feedRepo';
import { addMeasurement } from '../db/measurementRepo';
import { addTemperatureLog } from '../db/temperatureRepo';
import { addDiaperLog } from '../db/diaperRepo';
import { runSql } from '../db/client';

export const clearDemoData = async (babyId: string) => {
  await runSql('DELETE FROM feed_events WHERE baby_id = ?;', [babyId]);
  await runSql('DELETE FROM measurements WHERE baby_id = ?;', [babyId]);
  await runSql('DELETE FROM temperature_logs WHERE baby_id = ?;', [babyId]);
  await runSql('DELETE FROM diaper_logs WHERE baby_id = ?;', [babyId]);
};

export const seedDemoData = async (babyId: string) => {
  const now = new Date();
  const days = 180;

  for (let day = days - 1; day >= 0; day -= 1) {
    const dayBase = new Date(now);
    dayBase.setHours(0, 0, 0, 0);
    dayBase.setDate(dayBase.getDate() - day);

    const feedSlots = [1, 5, 9, 13, 17, 21];
    for (let slot = 0; slot < feedSlots.length; slot += 1) {
      const at = new Date(dayBase);
      at.setHours(feedSlots[slot], (slot % 3) * 10, 0, 0);
      const isBottle = slot % 2 === 0;
      await addFeed(babyId, {
        timestamp: at.toISOString(),
        type: isBottle ? (slot % 4 === 0 ? 'formula' : 'bottle') : 'breast',
        amount_ml: isBottle ? 80 + ((day + slot) % 8) * 12 : null,
        duration_minutes: isBottle ? null : 10 + ((day + slot) % 6) * 3,
        side: isBottle ? 'none' : slot % 3 === 0 ? 'left' : slot % 3 === 1 ? 'right' : 'both',
        notes: day === 0 && slot === feedSlots.length - 1 ? 'Latest feed sample' : null,
      });
    }

    if (day % 7 === 0) {
      const at = new Date(dayBase);
      at.setHours(10, 0, 0, 0);
      const weeksFromStart = (days - day) / 7;
      await addMeasurement(babyId, {
        timestamp: at.toISOString(),
        weight_kg: 3.4 + weeksFromStart * 0.12,
        length_cm: 51 + weeksFromStart * 0.45,
        head_circumference_cm: 34.2 + weeksFromStart * 0.18,
        notes: day === 0 ? 'Most recent weekly check' : null,
      });
    }

    if (day % 2 === 0) {
      const at = new Date(dayBase);
      at.setHours(19, 0, 0, 0);
      await addTemperatureLog(babyId, {
        timestamp: at.toISOString(),
        temperature_c: 36.5 + ((day % 5) * 0.12),
        notes: null,
      });
    }

    for (let d = 0; d < 5; d += 1) {
      const at = new Date(dayBase);
      at.setHours(3 + d * 4, (d % 2) * 15, 0, 0);
      const hadPoop = (day + d) % 3 === 0;
      await addDiaperLog(babyId, {
        timestamp: at.toISOString(),
        had_pee: 1,
        had_poop: hadPoop ? 1 : 0,
        poop_size: hadPoop ? (d % 3 === 0 ? 'small' : d % 3 === 1 ? 'medium' : 'large') : null,
        notes: null,
      });
    }
  }
};
