import type { DomainEvent } from '../../../types/events';
import { getApiClient } from '../../../services/api';
import { useNetwork } from '../../../services/network';
import { OUTBOX } from '../../../lib/config';
import { deleteVoiceNote } from '../../../services/voiceNotesStore';
import { markFailed, markRetry, markSending, markSent, oldestPending } from './outboxRepo';

let running = false;

/** 4xx que não se resolve tentando de novo (ex.: 403 na rota de outro motorista, 422 payload inválido). */
export function isPermanentFailure(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status !== 'number') return false;
  return status >= 400 && status < 500 && !OUTBOX.retryableClientStatus.includes(status);
}

/**
 * Envia a fila estritamente em ordem FIFO, um por vez.
 * - Sem rede: retorna cedo sem tocar no SQLite.
 * - Rede fraca: só eventos críticos (chegada, ocorrência, descarga, resultado da ligação).
 * - Se a cabeça da fila ainda estiver aguardando backoff (`next_try_at > now`), para o ciclo e não pula para o item 2.
 * - 409 = servidor já tinha o evento (idempotência) → conta como enviado.
 * - 4xx definitivo (403, 404, 422…) → `failed` na hora; a fila segue para o próximo item.
 * - Outros erros (sem rede, timeout, 5xx, 401, 429) → backoff exponencial; a fila para até a próxima tentativa.
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
      } catch (error) {
        if (isPermanentFailure(error)) {
          markFailed(head);
          continue;
        }
        markRetry(head);
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
