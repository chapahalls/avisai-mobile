import type { DomainEvent } from '../../../types/events';
import { getApiClient } from '../../../services/api';
import { useNetwork } from '../../../services/network';
import { deleteVoiceNote } from '../../../services/voiceNotesStore';
import { markRetry, markSending, markSent, oldestPending } from './outboxRepo';

const MAX_ATTEMPTS = 8;
let running = false;

/**
 * Envia a fila estritamente em ordem FIFO, um por vez.
 * - Sem rede: retorna cedo sem tocar no SQLite.
 * - Rede fraca: só eventos críticos (chegada, ocorrência, descarga, resultado da ligação).
 * - Se a cabeça da fila ainda estiver aguardando backoff (`next_try_at > now`), para o ciclo e não pula para o item 2.
 * - 409 = servidor já tinha o evento (idempotência) → conta como enviado.
 * - `DriverVoiceNote` (fala gravada sem sinal) sobe como áudio; o arquivo local é apagado
 *   assim que o servidor confirma.
 */
export async function flushOutbox() {
  if (running) return;
  const quality = useNetwork.getState().quality();
  if (quality === 'offline') return;

  running = true;
  try {
    while (true) {
      const currentQuality = useNetwork.getState().quality();
      if (currentQuality === 'offline') break;

      const head = oldestPending(currentQuality === 'weak');
      if (!head) break;

      if (head.next_try_at > Date.now()) {
        // Preserva estritamente a ordem FIFO: não envia o item 2 enquanto o item 1 aguarda retry
        break;
      }

      markSending(head.id);
      const event = JSON.parse(head.payload) as DomainEvent;
      try {
        const api = getApiClient();
        const res = event.type === 'DriverVoiceNote' ? await api.uploadVoiceNote(event) : await api.postEvent(event);
        markSent(head.id, res.receivedAt);
        if (event.type === 'DriverVoiceNote') {
          void deleteVoiceNote(String((event.payload as { filePath?: string }).filePath ?? ''));
        }
      } catch {
        markRetry(head, MAX_ATTEMPTS);
        break;
      }
    }
  } finally {
    running = false;
  }
}

export function startSyncEngine() {
  const timer = setInterval(() => {
    void flushOutbox();
  }, 2000);
  return () => clearInterval(timer);
}
