import { describe, expect, it } from 'vitest';
import { isVoiceAgentParticipant } from '../features/voice/rules/agentParticipant';

describe('isVoiceAgentParticipant', () => {
  it('reconhece o agente pelo kind do LiveKit ou pela identidade do backend', () => {
    expect(isVoiceAgentParticipant({ identity: 'rodar-agente-44' })).toBe(true);
    expect(isVoiceAgentParticipant({ identity: 'agent-AJ_x', isAgent: true })).toBe(true);
  });

  it('ignora o participante de controle que o backend usa para a fala proativa', () => {
    // Entra e sai em ~150 ms; a saída dele não pode derrubar a conversa do motorista.
    expect(isVoiceAgentParticipant({ identity: 'rodar-control-rodar-agente-44' })).toBe(false);
    expect(isVoiceAgentParticipant({ identity: 'rodar-control-rodar-agente-44', isAgent: true })).toBe(false);
  });

  it('ignora outros participantes comuns', () => {
    expect(isVoiceAgentParticipant({ identity: 'motorista-2' })).toBe(false);
    expect(isVoiceAgentParticipant({ identity: 'operador-1', isAgent: false })).toBe(false);
  });
});
