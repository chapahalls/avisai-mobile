import { db } from '../../../lib/db';
import { newId } from '../../../lib/id';
import { CRITICAL_EVENTS, type DomainEvent, type EventType } from '../../../types/events';
import type { OutboxRow } from '../types';

type OutboxListener = () => void;
const listeners = new Set<OutboxListener>();

export function onOutboxChange(listener: OutboxListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyOutboxChange() {
  listeners.forEach((fn) => fn());
}

/**
 * Toda escrita do app passa por aqui (offline-first):
 * 1) grava em `events` (a tela lê daqui na hora);
 * 2) grava em `outbox` com idempotency_key (o envio acontece quando houver rede).
 */
export function enqueue(
  tripId: string,
  type: EventType,
  payload: Record<string, unknown>,
  source: DomainEvent['source'] = 'driver',
): DomainEvent {
  const event: DomainEvent = {
    id: newId(),
    idempotencyKey: newId(),
    tripId,
    type,
    occurredAt: new Date().toISOString(),
    source,
    payload,
  };
  db.withTransactionSync(() => {
    db.runSync(
      'INSERT INTO events (id, trip_id, type, payload, occurred_at) VALUES (?, ?, ?, ?, ?)',
      event.id,
      tripId,
      type,
      JSON.stringify(event),
      event.occurredAt,
    );
    db.runSync(
      'INSERT INTO outbox (id, type, payload, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?)',
      event.id,
      type,
      JSON.stringify(event),
      event.idempotencyKey,
      Date.now(),
    );
  });
  notifyOutboxChange();
  return event;
}

export const listOutbox = () =>
  db.getAllSync<OutboxRow>('SELECT * FROM outbox ORDER BY created_at DESC, rowid DESC LIMIT 100');

/**
 * Busca estritamente a cabeça (item mais antigo) da fila pendente.
 * Em rede fraca (`onlyCritical = true`), considera apenas eventos críticos em ordem FIFO.
 */
export const oldestPending = (onlyCritical = false): OutboxRow | null => {
  const rows = db.getAllSync<OutboxRow>(
    "SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at ASC, rowid ASC",
  );
  if (!onlyCritical) return rows[0] ?? null;
  return rows.find((r) => CRITICAL_EVENTS.includes(r.type as EventType)) ?? null;
};

export const duePending = (now: number) =>
  db.getAllSync<OutboxRow>(
    "SELECT * FROM outbox WHERE status = 'pending' AND next_try_at <= ? ORDER BY created_at ASC, rowid ASC",
    now,
  );

export const resetStuckSending = () => {
  db.runSync("UPDATE outbox SET status = 'pending' WHERE status = 'sending'");
  notifyOutboxChange();
};

export const markSending = (id: string) => {
  db.runSync("UPDATE outbox SET status = 'sending' WHERE id = ?", id);
  notifyOutboxChange();
};

export const markSent = (id: string, receivedAt = new Date().toISOString()) => {
  db.withTransactionSync(() => {
    db.runSync("UPDATE outbox SET status = 'sent' WHERE id = ?", id);
    db.runSync('UPDATE events SET synced = 1, received_at = ? WHERE id = ?', receivedAt, id);
  });
  notifyOutboxChange();
};

export const markRetry = (row: OutboxRow, maxAttempts: number) => {
  const attempts = row.attempts + 1;
  const backoffMs = Math.min(60_000, 2 ** attempts * 1000);
  const status = attempts > maxAttempts ? 'failed' : 'pending';
  db.runSync(
    'UPDATE outbox SET attempts = ?, status = ?, next_try_at = ? WHERE id = ?',
    attempts,
    status,
    Date.now() + backoffMs,
    row.id,
  );
  notifyOutboxChange();
};

export const retryFailed = () => {
  db.runSync("UPDATE outbox SET status = 'pending', attempts = 0, next_try_at = 0 WHERE status = 'failed'");
  notifyOutboxChange();
};

export const countPending = () =>
  db.getFirstSync<{ n: number }>("SELECT COUNT(*) AS n FROM outbox WHERE status != 'sent'")?.n ?? 0;
