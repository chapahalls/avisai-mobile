/**
 * Quem, na sala LiveKit do motorista, é o agente de voz.
 *
 * A sala também recebe participantes de passagem: para uma fala proativa (lembrete do CCO,
 * aviso de aproximação), o backend entra como `rodar-control-<agente>`, manda um pacote de
 * dados ao agente e sai em ~150 ms. Tratar essa saída como "o agente saiu" derrubava a
 * conversa do motorista a cada aviso. Só o agente abre ou encerra a conversa.
 */
export interface ParticipantLike {
  identity: string;
  isAgent?: boolean;
}

const AGENT_PREFIX = 'rodar-agente-';
const CONTROL_PREFIX = 'rodar-control-';

export function isVoiceAgentParticipant(p: ParticipantLike): boolean {
  if (p.identity.startsWith(CONTROL_PREFIX)) return false;
  return p.isAgent === true || p.identity.startsWith(AGENT_PREFIX);
}
