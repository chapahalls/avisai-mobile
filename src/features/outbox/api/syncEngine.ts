import { CRITICAL_EVENTS, type DomainEvent } from '../../../types/events';
import { postEvent } from '../../../services/mockApi';
import { useNetwork } from '../../../services/network';
import { duePending, markRetry, markSent } from './outboxRepo';
import { useOutboxStore } from '../hooks/useOutbox';

const MAX_ATTEMPTS = 8;
let running = false;

/**
 * Envia a fila em ordem, um por vez.
 * - Sem rede: não tenta.
 * - Rede fraca: só eventos críticos (chegada, ocorrência, descarga, resultado da ligação).
 * - 409 = servidor já tinha o evento (idempotência) → conta como enviado.
 */
async function flush() {
  if (running) return;
  running = true;
  try {
    const quality = useNetwork.getState().quality();
    if (quality === 'offline') return;
    for (const row of duePending(Date.now())) {
      const event = JSON.parse(row.payload) as DomainEvent;
      if (quality === 'weak' && !CRITICAL_EVENTS.includes(event.type)) continue;
      try {
        await postEvent(event);
        markSent(row.id);
      } catch {
        markRetry(row, MAX_ATTEMPTS);
        break; // mantém a ordem: não pula para o próximo
      }
    }
  } finally {
    running = false;
    useOutboxStore.getState().refresh();
  }
}

export function startSyncEngine() {
  const timer = setInterval(flush, 2000);
  return () => clearInterval(timer);
}
