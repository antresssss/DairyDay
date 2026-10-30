import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import type { CollectionEntry, DashboardTotals, LedgerRow, Shift } from './types';

export const SCHEMA_VERSION = 1;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function utcNowIso(): string {
  return new Date().toISOString();
}

async function migrateIfNeeded(db: SQLite.SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentDbVersion = result?.user_version ?? 0;
  if (currentDbVersion >= SCHEMA_VERSION) {
    return;
  }

  if (currentDbVersion === 0) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE collection_entries ADD COLUMN created_at TEXT;
        ALTER TABLE collection_entries ADD COLUMN updated_at TEXT;
        ALTER TABLE collection_entries ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE collection_entries ADD COLUMN synced_at TEXT;
      `);
      const now = utcNowIso();
      await db.runAsync(
        `UPDATE collection_entries
         SET created_at = ?, updated_at = ?, is_deleted = 0`,
        [now, now]
      );
    });
    currentDbVersion = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

async function ensureFarmerId(db: SQLite.SQLiteDatabase): Promise<string> {
  const existing = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM profile WHERE key = 'farmer_id'"
  );
  if (existing?.value) {
    return existing.value;
  }

  const farmerId = Crypto.randomUUID();
  await db.runAsync(
    'INSERT INTO profile (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING',
    ['farmer_id', farmerId]
  );
  const stored = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM profile WHERE key = 'farmer_id'"
  );
  return stored?.value ?? farmerId;
}

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
      await migrateIfNeeded(db);
      await ensureFarmerId(db);
      return db;
    })();
  }
  return dbPromise;
}

export async function getFarmerId(): Promise<string> {
  const db = await getDb();
  return ensureFarmerId(db);
}

export async function getEntryByDate(date: string): Promise<CollectionEntry | null> {
  const db = await getDb();
  return db.getFirstAsync<CollectionEntry>(
    `SELECT id, date, morning_litres, afternoon_litres, rate
     FROM collection_entries
     WHERE date = ? AND is_deleted = 0`,
    [date]
  );
}

async function getEntryRowByDate(date: string): Promise<CollectionEntry | null> {
  const db = await getDb();
  return db.getFirstAsync<CollectionEntry>(
    `SELECT id, date, morning_litres, afternoon_litres, rate
     FROM collection_entries
     WHERE date = ?`,
    [date]
  );
}

export async function getLatestRate(): Promise<number | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ rate: number }>(
    `SELECT rate FROM collection_entries
     WHERE is_deleted = 0
     ORDER BY date DESC LIMIT 1`
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
  const existing = await getEntryRowByDate(params.date);
  const morning =
    params.shift === 'morning' ? params.litres : (existing?.morning_litres ?? null);
  const afternoon =
    params.shift === 'afternoon' ? params.litres : (existing?.afternoon_litres ?? null);
  const now = utcNowIso();

  if (existing) {
    await db.runAsync(
      `UPDATE collection_entries
       SET morning_litres = ?, afternoon_litres = ?, rate = ?,
           updated_at = ?, is_deleted = 0
       WHERE date = ?`,
      [morning, afternoon, params.rate, now, params.date]
    );
    return;
  }

  await db.runAsync(
    `INSERT INTO collection_entries
       (date, morning_litres, afternoon_litres, rate, created_at, updated_at, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [params.date, morning, afternoon, params.rate, now, now]
  );
}

export async function softDeleteEntry(date: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE collection_entries
     SET is_deleted = 1, updated_at = ?
     WHERE date = ?`,
    [utcNowIso(), date]
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
     WHERE date BETWEEN ? AND ?
       AND is_deleted = 0`,
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
       AND is_deleted = 0
     ORDER BY date`,
    [start, end]
  );
}

export async function getLoggedDates(start: string, end: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT date FROM collection_entries
     WHERE date BETWEEN ? AND ?
       AND is_deleted = 0
     ORDER BY date`,
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

export type ExportEntry = {
  farmer_id: string;
  date: string;
  morning_litres: number | null;
  afternoon_litres: number | null;
  rate: number;
  created_at: string | null;
  updated_at: string | null;
  is_deleted: number;
};

export type ExportPayload = {
  schema_version: number;
  exported_at: string;
  farmer: {
    farmer_id: string;
    farmer_name: string;
    farmer_address: string;
  };
  entries: ExportEntry[];
};

export async function exportAllDataJson(): Promise<ExportPayload> {
  const db = await getDb();
  const [farmerId, profile, rows] = await Promise.all([
    getFarmerId(),
    getProfile(),
    db.getAllAsync<{
      date: string;
      morning_litres: number | null;
      afternoon_litres: number | null;
      rate: number;
      created_at: string | null;
      updated_at: string | null;
      is_deleted: number;
    }>(
      `SELECT date, morning_litres, afternoon_litres, rate,
              created_at, updated_at, is_deleted
       FROM collection_entries
       ORDER BY date`
    ),
  ]);

  return {
    schema_version: SCHEMA_VERSION,
    exported_at: utcNowIso(),
    farmer: {
      farmer_id: farmerId,
      farmer_name: profile.farmer_name,
      farmer_address: profile.farmer_address,
    },
    entries: rows.map((row) => ({
      farmer_id: farmerId,
      date: row.date,
      morning_litres: row.morning_litres,
      afternoon_litres: row.afternoon_litres,
      rate: row.rate,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_deleted: row.is_deleted,
    })),
  };
}
