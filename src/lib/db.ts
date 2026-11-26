import type * as SQLiteTypes from 'expo-sqlite';

let rawDb: SQLiteTypes.SQLiteDatabase | null = null;
let migrated = false;
const memorySettings = new Map<string, string>();

const memoryFallbackDb = {
  execSync: () => undefined,
  runSync: () => ({ changes: 0, lastInsertRowId: 0 }),
  getAllSync: () => [],
  getFirstSync: () => null,
  withTransactionSync: (cb: () => void) => cb(),
} as unknown as SQLiteTypes.SQLiteDatabase;

function loadSQLite(): typeof SQLiteTypes {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-sqlite') as typeof SQLiteTypes;
}

/**
 * Só para testes: usa outro banco com a mesma API síncrona (ex.: SQLite em memória via sql.js)
 * e roda a migração do app nele. Sem isso, os testes usam um banco vazio de faz de conta.
 */
export function setTestDatabase(database: SQLiteTypes.SQLiteDatabase): void {
  rawDb = database;
  migrated = false;
}

export function getDb(): SQLiteTypes.SQLiteDatabase {
  if (process.env.VITEST && !rawDb) {
    return memoryFallbackDb;
  }
  if (!rawDb) {
    const SQLite = loadSQLite();
    rawDb = SQLite.openDatabaseSync('avisai.db');
  }
  if (!migrated) {
    runMigrations(rawDb);
  }
  return rawDb;
}

function runMigrations(database: SQLiteTypes.SQLiteDatabase) {
  migrated = true;
  database.execSync(`
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
      received_at TEXT,
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
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  const columns = database.getAllSync<{ name: string }>('PRAGMA table_info(events)');
  const hasReceivedAt = columns.some((c) => c.name === 'received_at');
  if (!hasReceivedAt) {
    database.execSync('ALTER TABLE events ADD COLUMN received_at TEXT;');
  }
}

/** Proxy para manter compatibilidade com `db.runSync(...)` garantindo migração prévia. */
export const db: SQLiteTypes.SQLiteDatabase = new Proxy({} as SQLiteTypes.SQLiteDatabase, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export function migrate() {
  const SQLite = loadSQLite();
  const instance = rawDb ?? (rawDb = SQLite.openDatabaseSync('avisai.db'));
  runMigrations(instance);
}

export function resetLocalData() {
  getDb().execSync('DELETE FROM outbox; DELETE FROM events;');
}

export function getSetting(key: string): string | null {
  if (process.env.VITEST) return memorySettings.get(key) ?? null;
  try {
    const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
    return row?.value ?? memorySettings.get(key) ?? null;
  } catch {
    return memorySettings.get(key) ?? null;
  }
}

export function setSetting(key: string, value: string): void {
  memorySettings.set(key, value);
  if (process.env.VITEST) return;
  try {
    getDb().runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
  } catch {
    // Ignora falha silenciosa em ambiente de teste sem SQLite nativo
  }
}
