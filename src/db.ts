import * as SQLite from 'expo-sqlite';

import type { CollectionEntry, DashboardTotals, LedgerRow, Shift } from './types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('dairyday.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS collection_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL UNIQUE,
          morning_litres REAL,
          afternoon_litres REAL,
          rate REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS profile (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function getEntryByDate(date: string): Promise<CollectionEntry | null> {
  const db = await getDb();
  return db.getFirstAsync<CollectionEntry>(
    'SELECT id, date, morning_litres, afternoon_litres, rate FROM collection_entries WHERE date = ?',
    [date]
  );
}

export async function getLatestRate(): Promise<number | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ rate: number }>(
    'SELECT rate FROM collection_entries ORDER BY date DESC LIMIT 1'
  );
  return row?.rate ?? null;
}

export async function upsertShift(params: {
  date: string;
  shift: Shift;
  litres: number;
  rate: number;
}): Promise<void> {
  const db = await getDb();
  const existing = await getEntryByDate(params.date);
  const morning =
    params.shift === 'morning' ? params.litres : (existing?.morning_litres ?? null);
  const afternoon =
    params.shift === 'afternoon' ? params.litres : (existing?.afternoon_litres ?? null);

  if (existing) {
    await db.runAsync(
      'UPDATE collection_entries SET morning_litres = ?, afternoon_litres = ?, rate = ? WHERE date = ?',
      [morning, afternoon, params.rate, params.date]
    );
    return;
  }

  await db.runAsync(
    'INSERT INTO collection_entries (date, morning_litres, afternoon_litres, rate) VALUES (?, ?, ?, ?)',
    [params.date, morning, afternoon, params.rate]
  );
}

export async function getMonthSummary(start: string, end: string): Promise<DashboardTotals> {
  const db = await getDb();
  const row = await db.getFirstAsync<DashboardTotals>(
    `SELECT
       COALESCE(SUM(COALESCE(morning_litres,0) + COALESCE(afternoon_litres,0)), 0) AS total_litres,
       COALESCE(SUM((COALESCE(morning_litres,0) + COALESCE(afternoon_litres,0)) * rate), 0) AS total_revenue,
       COUNT(*) AS days_logged
     FROM collection_entries
     WHERE date BETWEEN ? AND ?`,
    [start, end]
  );
  return row ?? { total_litres: 0, total_revenue: 0, days_logged: 0 };
}

export async function getLedgerRows(start: string, end: string): Promise<LedgerRow[]> {
  const db = await getDb();
  return db.getAllAsync<LedgerRow>(
    `SELECT date, morning_litres, afternoon_litres,
            (COALESCE(morning_litres,0) + COALESCE(afternoon_litres,0)) AS total,
            rate,
            (COALESCE(morning_litres,0) + COALESCE(afternoon_litres,0)) * rate AS amount
     FROM collection_entries
     WHERE date BETWEEN ? AND ?
     ORDER BY date`,
    [start, end]
  );
}

export async function getLoggedDates(start: string, end: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT date FROM collection_entries WHERE date BETWEEN ? AND ? ORDER BY date',
    [start, end]
  );
  return rows.map((row) => row.date);
}

export async function getProfile(): Promise<{ farmer_name: string; farmer_address: string }> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM profile');
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    farmer_name: map.farmer_name ?? '',
    farmer_address: map.farmer_address ?? '',
  };
}

export async function saveProfile(farmer_name: string, farmer_address: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO profile (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ['farmer_name', farmer_name.trim()]
  );
  await db.runAsync(
    'INSERT INTO profile (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ['farmer_address', farmer_address.trim()]
  );
}
