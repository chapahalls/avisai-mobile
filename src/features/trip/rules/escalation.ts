import { BUSINESS } from '../../../lib/config';

/** Canal sobe a cada tentativa sem resposta do CCO (decisão 5 do repo de ideias). */
export const CCO_CHANNELS = ['push', 'painel', 'ligação'] as const;

export function channelFor(attempt: number) {
  return CCO_CHANNELS[Math.min(attempt, CCO_CHANNELS.length) - 1];
}

export const shouldCallReceiver = (attempts: number, ccoAcknowledged: boolean) =>
  !ccoAcknowledged && attempts >= BUSINESS.maxCcoAttempts;
