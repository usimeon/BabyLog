import { runSql, withTransaction } from './client';

const DATA_TABLES = [
  'feed_events',
  'measurements',
  'temperature_logs',
  'diaper_logs',
  'medication_logs',
  'milestones',
  'babies',
] as const;

export const clearLocalAccountData = async () => {
  await withTransaction(async () => {
    for (const table of DATA_TABLES) {
      await runSql(`DELETE FROM ${table};`);
    }
    await runSql('DELETE FROM settings;');
  });
};

