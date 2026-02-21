import { execSql, getOne, runSql } from './client';

const MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS babies (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        birthdate TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        dirty INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS feed_events (
        local_id INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT UNIQUE NOT NULL,
        baby_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        amount_ml REAL,
        duration_minutes INTEGER,
        side TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        dirty INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_feed_events_baby_timestamp ON feed_events (baby_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_feed_events_dirty ON feed_events (dirty);

      CREATE TABLE IF NOT EXISTS measurements (
        local_id INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT UNIQUE NOT NULL,
        baby_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        weight_kg REAL NOT NULL,
        length_cm REAL,
        head_circumference_cm REAL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        dirty INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_measurements_baby_timestamp ON measurements (baby_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_measurements_dirty ON measurements (dirty);
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS temperature_logs (
        local_id INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT UNIQUE NOT NULL,
        baby_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        temperature_c REAL NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        dirty INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_temperature_logs_baby_timestamp ON temperature_logs (baby_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_temperature_logs_dirty ON temperature_logs (dirty);

      CREATE TABLE IF NOT EXISTS diaper_logs (
        local_id INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT UNIQUE NOT NULL,
        baby_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        had_pee INTEGER NOT NULL DEFAULT 0,
        had_poop INTEGER NOT NULL DEFAULT 0,
        poop_size TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        dirty INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_diaper_logs_baby_timestamp ON diaper_logs (baby_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_diaper_logs_dirty ON diaper_logs (dirty);
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS medication_logs (
        local_id INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT UNIQUE NOT NULL,
        baby_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        medication_name TEXT NOT NULL,
        dose_value REAL NOT NULL,
        dose_unit TEXT NOT NULL,
        min_interval_hours REAL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        dirty INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_medication_logs_baby_timestamp ON medication_logs (baby_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_medication_logs_dirty ON medication_logs (dirty);

      CREATE TABLE IF NOT EXISTS milestones (
        local_id INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT UNIQUE NOT NULL,
        baby_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        title TEXT NOT NULL,
        notes TEXT,
        photo_uri TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        dirty INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_milestones_baby_timestamp ON milestones (baby_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_milestones_dirty ON milestones (dirty);
    `,
  },
  {
    version: 4,
    sql: `
      CREATE INDEX IF NOT EXISTS idx_babies_dirty ON babies (dirty);
      CREATE INDEX IF NOT EXISTS idx_feed_events_baby ON feed_events (baby_id);
      CREATE INDEX IF NOT EXISTS idx_measurements_baby ON measurements (baby_id);
      CREATE INDEX IF NOT EXISTS idx_temperature_logs_baby ON temperature_logs (baby_id);
      CREATE INDEX IF NOT EXISTS idx_diaper_logs_baby ON diaper_logs (baby_id);
      CREATE INDEX IF NOT EXISTS idx_medication_logs_baby ON medication_logs (baby_id);
      CREATE INDEX IF NOT EXISTS idx_milestones_baby ON milestones (baby_id);

      DELETE FROM feed_events
      WHERE baby_id IS NULL
         OR trim(baby_id) = ''
         OR baby_id NOT IN (SELECT id FROM babies);

      DELETE FROM measurements
      WHERE baby_id IS NULL
         OR trim(baby_id) = ''
         OR baby_id NOT IN (SELECT id FROM babies);

      DELETE FROM temperature_logs
      WHERE baby_id IS NULL
         OR trim(baby_id) = ''
         OR baby_id NOT IN (SELECT id FROM babies);

      DELETE FROM diaper_logs
      WHERE baby_id IS NULL
         OR trim(baby_id) = ''
         OR baby_id NOT IN (SELECT id FROM babies);

      DELETE FROM medication_logs
      WHERE baby_id IS NULL
         OR trim(baby_id) = ''
         OR baby_id NOT IN (SELECT id FROM babies);

      DELETE FROM milestones
      WHERE baby_id IS NULL
         OR trim(baby_id) = ''
         OR baby_id NOT IN (SELECT id FROM babies);
    `,
  },
  {
    version: 5,
    sql: `
      ALTER TABLE babies ADD COLUMN photo_uri TEXT;
    `,
  },
];

export const migrate = async () => {
  await execSql('PRAGMA journal_mode = WAL;');
  await execSql(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL
    );
  `);

  for (const migration of MIGRATIONS) {
    const found = await getOne<{ version: number }>(
      'SELECT version FROM schema_migrations WHERE version = ? LIMIT 1;',
      [migration.version],
    );

    if (!found) {
      await execSql('BEGIN TRANSACTION;');
      try {
        await execSql(migration.sql);
        await runSql('INSERT INTO schema_migrations(version) VALUES (?);', [migration.version]);
        await execSql('COMMIT;');
      } catch (error) {
        await execSql('ROLLBACK;');
        throw error;
      }
    }
  }
};
