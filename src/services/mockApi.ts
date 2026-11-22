import type { DomainEvent } from '../types/events';
import { useNetwork } from './network';

/**
 * Servidor mock dentro do app. Simula latência, falhas e idempotência.
 * Trocar por fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/events`) quando o agent-server existir.
 */
const received = new Map<string, DomainEvent>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class NetworkError extends Error {}

export async function postEvent(event: DomainEvent): Promise<{ status: 200 | 409 }> {
  const q = useNetwork.getState().quality();
  if (q === 'offline') throw new NetworkError('offline');
  await sleep(q === 'weak' ? 1500 : 300);
  if (Math.random() < (q === 'weak' ? 0.4 : 0.08)) throw new NetworkError('timeout');
  if (received.has(event.idempotencyKey)) return { status: 409 };
  received.set(event.idempotencyKey, { ...event, receivedAt: new Date().toISOString() });
  return { status: 200 };
}

/** Resultado mock do aviso/ligação ao recebedor. */
export type ReceiverAnswer =
  | { kind: 'confirmed'; dock: string; time: string }
  | { kind: 'not_today' }
  | { kind: 'no_answer' };

export async function callReceiver(attempt: 'approach' | 'escalation'): Promise<ReceiverAnswer> {
  await sleep(2500);
  const r = Math.random();
  if (attempt === 'approach') {
    if (r < 0.7) return { kind: 'confirmed', dock: '4', time: '15:00' };
    if (r < 0.85) return { kind: 'not_today' };
    return { kind: 'no_answer' };
  }
  return r < 0.75 ? { kind: 'confirmed', dock: '2', time: 'em 40 minutos' } : { kind: 'no_answer' };
}

/** SSO genérico mock. */
export async function ssoLogin(): Promise<{ token: string; name: string; company: string }> {
  await sleep(800);
  return { token: 'mock-token', name: 'Motorista Demo', company: 'Transportadora Exemplo' };
}
