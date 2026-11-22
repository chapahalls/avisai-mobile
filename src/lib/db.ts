import * as SQLite from 'expo-sqlite';

/** Banco local. Funciona no Expo Go. */
export const db = SQLite.openDatabaseSync('avisai.db');

export function migrate() {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      next_try_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY NOT NULL,
      trip_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY NOT NULL,
      trip_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY NOT NULL,
      document_id TEXT NOT NULL,
      text TEXT NOT NULL,
      embedding TEXT NOT NULL
    );
  `);
}

export function resetLocalData() {
  db.execSync('DELETE FROM outbox; DELETE FROM events;');
}
