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
