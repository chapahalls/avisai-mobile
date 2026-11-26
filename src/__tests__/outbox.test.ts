import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkError } from '../services/apiClient';
import initSqlJs from 'sql.js';
import type { SQLiteDatabase } from 'expo-sqlite';
import { db, resetLocalData, setTestDatabase } from '../lib/db';
import { OUTBOX } from '../lib/config';
import { enqueue, flushOutbox, isPermanentFailure, retryFailed } from '../features/outbox';

// vi.mock é içado para antes dos imports: os módulos acima já recebem os mocks.

type Quality = 'good' | 'weak' | 'offline';
const net = vi.hoisted(() => ({ quality: 'good' as Quality }));
vi.mock('../services/network', () => ({
  useNetwork: { getState: () => ({ quality: () => net.quality }) },
}));

const api = vi.hoisted(() => ({
  postEvent: vi.fn(),
  uploadVoiceNote: vi.fn(),
}));
vi.mock('../services/api', () => ({ getApiClient: () => api }));

const voiceNotes = vi.hoisted(() => ({ deleteVoiceNote: vi.fn(async () => undefined) }));
vi.mock('../services/voiceNotesStore', () => voiceNotes);


interface Row {
  id: string;
  type: string;
  status: string;
  attempts: number;
  next_try_at: number;
}
const rows = () => db.getAllSync<Row>('SELECT * FROM outbox ORDER BY created_at ASC, rowid ASC');
const statusOf = (id: string) => rows().find((r) => r.id === id)?.status;
const synced = (id: string) =>
  db.getFirstSync<{ synced: number; received_at: string | null }>(
    'SELECT synced, received_at FROM events WHERE id = ?',
    id,
  );

// SQLite de verdade (sql.js, em memória) com a mesma API síncrona do expo-sqlite:
// a migração e as consultas do app rodam como no aparelho.
beforeAll(async () => {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const params = (args: unknown[]) =>
    (args.length === 1 && (Array.isArray(args[0]) || typeof args[0] === 'object') ? args[0] : args) as never;
  const all = (sql: string, ...args: unknown[]) => {
    const stmt = raw.prepare(sql);
    stmt.bind(params(args));
    const out: Record<string, unknown>[] = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    stmt.free();
    return out;
  };
  setTestDatabase({
    execSync: (sql: string) => {
      raw.exec(sql);
    },
    runSync: (sql: string, ...args: unknown[]) => {
      raw.run(sql, params(args));
      return { changes: raw.getRowsModified(), lastInsertRowId: 0 };
    },
    getAllSync: all,
    getFirstSync: (sql: string, ...args: unknown[]) => all(sql, ...args)[0] ?? null,
    withTransactionSync: (fn: () => void) => {
      raw.exec('BEGIN');
      try {
        fn();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as SQLiteDatabase);
});

beforeEach(() => {
  resetLocalData();
  net.quality = 'good';
  api.postEvent.mockReset();
  api.uploadVoiceNote.mockReset();
  voiceNotes.deleteVoiceNote.mockClear();
});

const ok = (receivedAt = '2026-11-26T12:00:00.000Z') => ({ status: 200 as const, receivedAt });

describe('outbox: enfileirar', () => {
  it('grava o evento local e o item da fila na mesma transação, com chave de idempotência', () => {
    const event = enqueue('trip-1', 'ArrivalRegistered', { lat: -22.9 });
    const [row] = rows();
    expect(row).toMatchObject({ id: event.id, type: 'ArrivalRegistered', status: 'pending', attempts: 0 });
    expect(event.idempotencyKey).toBeTruthy();
    expect(event.idempotencyKey).not.toBe(event.id);
    expect(synced(event.id)).toEqual({ synced: 0, received_at: null });
  });
});

describe('outbox: envio', () => {
  it('envia em ordem FIFO estrita e marca o evento como sincronizado com o horário do servidor', async () => {
    const a = enqueue('trip-1', 'PickupConfirmed', {});
    const b = enqueue('trip-1', 'ApproachDetected', {});
    const c = enqueue('trip-1', 'ArrivalRegistered', {});
    api.postEvent.mockResolvedValue(ok());

    await flushOutbox();

    expect(api.postEvent.mock.calls.map(([e]) => e.id)).toEqual([a.id, b.id, c.id]);
    expect(rows().every((r) => r.status === 'sent')).toBe(true);
    expect(synced(a.id)).toEqual({ synced: 1, received_at: '2026-11-26T12:00:00.000Z' });
  });

  it('409 (o servidor já tinha o evento) conta como enviado', async () => {
    const a = enqueue('trip-1', 'ArrivalRegistered', {});
    api.postEvent.mockResolvedValue({ status: 409, receivedAt: '2026-11-26T11:00:00.000Z' });

    await flushOutbox();

    expect(statusOf(a.id)).toBe('sent');
    expect(synced(a.id)?.synced).toBe(1);
  });

  it('sem rede não toca na fila', async () => {
    enqueue('trip-1', 'ArrivalRegistered', {});
    net.quality = 'offline';

    await flushOutbox();

    expect(api.postEvent).not.toHaveBeenCalled();
    expect(rows()[0].status).toBe('pending');
  });

  it('em rede fraca envia só os eventos críticos, na ordem', async () => {
    const started = enqueue('trip-1', 'PickupConfirmed', {});
    const arrival = enqueue('trip-1', 'ArrivalRegistered', {});
    const occurrence = enqueue('trip-1', 'OccurrenceCreated', {});
    net.quality = 'weak';
    api.postEvent.mockResolvedValue(ok());

    await flushOutbox();

    expect(api.postEvent.mock.calls.map(([e]) => e.id)).toEqual([arrival.id, occurrence.id]);
    expect(statusOf(started.id)).toBe('pending');
  });

  it('fala gravada sem sinal sobe como áudio e o arquivo local é apagado depois da confirmação', async () => {
    const note = enqueue('trip-1', 'DriverVoiceNote', { filePath: '/docs/falas_offline/1.wav', durationMs: 1200 });
    api.uploadVoiceNote.mockResolvedValue(ok());

    await flushOutbox();

    expect(api.uploadVoiceNote).toHaveBeenCalledTimes(1);
    expect(api.postEvent).not.toHaveBeenCalled();
    expect(statusOf(note.id)).toBe('sent');
    expect(voiceNotes.deleteVoiceNote).toHaveBeenCalledWith('/docs/falas_offline/1.wav');
  });
});

describe('outbox: falhas', () => {
  it('erro temporário: backoff exponencial e a fila para (não pula para o item seguinte)', async () => {
    const a = enqueue('trip-1', 'PickupConfirmed', {});
    const b = enqueue('trip-1', 'ArrivalRegistered', {});
    api.postEvent.mockRejectedValueOnce(new NetworkError('timeout'));
    const before = Date.now();

    await flushOutbox();

    expect(api.postEvent).toHaveBeenCalledTimes(1);
    const head = rows().find((r) => r.id === a.id)!;
    expect(head).toMatchObject({ status: 'pending', attempts: 1 });
    expect(head.next_try_at).toBeGreaterThanOrEqual(before + 2000);
    expect(statusOf(b.id)).toBe('pending');

    // Ainda no backoff: o ciclo seguinte não envia nada, nem o item 2.
    await flushOutbox();
    expect(api.postEvent).toHaveBeenCalledTimes(1);
  });

  it('5xx é temporário', async () => {
    const a = enqueue('trip-1', 'PickupConfirmed', {});
    api.postEvent.mockRejectedValueOnce(new NetworkError('HTTP 503', 503));

    await flushOutbox();

    expect(rows().find((r) => r.id === a.id)).toMatchObject({ status: 'pending', attempts: 1 });
  });

  it('4xx definitivo (403: rota de outro motorista) vira failed na hora e a fila segue', async () => {
    const a = enqueue('trip-1', 'PickupConfirmed', {});
    const b = enqueue('trip-1', 'ArrivalRegistered', {});
    api.postEvent.mockRejectedValueOnce(new NetworkError('HTTP 403', 403)).mockResolvedValueOnce(ok());

    await flushOutbox();

    expect(statusOf(a.id)).toBe('failed');
    expect(statusOf(b.id)).toBe('sent');
    expect(api.postEvent).toHaveBeenCalledTimes(2);
  });

  it(`depois de ${OUTBOX.maxAttempts} tentativas o item vira failed; retryFailed devolve à fila`, async () => {
    const a = enqueue('trip-1', 'PickupConfirmed', {});
    db.runSync('UPDATE outbox SET attempts = ? WHERE id = ?', OUTBOX.maxAttempts, a.id);
    api.postEvent.mockRejectedValueOnce(new NetworkError('timeout'));

    await flushOutbox();
    expect(statusOf(a.id)).toBe('failed');

    retryFailed();
    expect(rows().find((r) => r.id === a.id)).toMatchObject({ status: 'pending', attempts: 0, next_try_at: 0 });
    api.postEvent.mockResolvedValueOnce(ok());
    await flushOutbox();
    expect(statusOf(a.id)).toBe('sent');
  });

  it('classifica os erros: 4xx definitivo × temporário', () => {
    expect(isPermanentFailure(new NetworkError('HTTP 403', 403))).toBe(true);
    expect(isPermanentFailure(new NetworkError('HTTP 422', 422))).toBe(true);
    expect(isPermanentFailure(new NetworkError('HTTP 401', 401))).toBe(false);
    expect(isPermanentFailure(new NetworkError('HTTP 429', 429))).toBe(false);
    expect(isPermanentFailure(new NetworkError('HTTP 500', 500))).toBe(false);
    expect(isPermanentFailure(new NetworkError('offline'))).toBe(false);
    expect(isPermanentFailure(new Error('qualquer'))).toBe(false);
  });
});
