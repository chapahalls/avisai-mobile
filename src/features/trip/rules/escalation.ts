import { BUSINESS } from '../../../lib/config';

/** Canal sobe a cada tentativa sem resposta do CCO (decisão 5 do repo de ideias). */
export const CCO_CHANNELS = ['push', 'painel', 'ligação'] as const;

export function channelFor(attempt: number) {
  const index = Math.max(1, Math.min(attempt, CCO_CHANNELS.length)) - 1;
  return CCO_CHANNELS[index];
}

export const shouldCallReceiver = (
  attempts: number,
  ccoAcknowledged: boolean,
  maxAttempts: number = BUSINESS.maxCcoAttempts,
) => !ccoAcknowledged && attempts >= maxAttempts;
