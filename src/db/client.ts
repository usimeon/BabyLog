import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('babylog.db');

export const getDb = () => db;

export const execSql = async (sql: string) => {
  await db.execAsync(sql);
};

export const runSql = async (sql: string, params: SQLite.SQLiteBindParams = []) => {
  return db.runAsync(sql, params);
};

export const getOne = async <T>(sql: string, params: SQLite.SQLiteBindParams = []) => {
  return db.getFirstAsync<T>(sql, params);
};

export const getAll = async <T>(sql: string, params: SQLite.SQLiteBindParams = []) => {
  return db.getAllAsync<T>(sql, params);
};

let transactionQueue: Promise<unknown> = Promise.resolve();

export const withTransaction = async <T>(work: () => Promise<T>) => {
  const run = async () => {
    await execSql('BEGIN IMMEDIATE TRANSACTION;');
    try {
      const result = await work();
      await execSql('COMMIT;');
      return result;
    } catch (error) {
      await execSql('ROLLBACK;');
      throw error;
    }
  };

  const next = transactionQueue.then(run, run);
  transactionQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
};
