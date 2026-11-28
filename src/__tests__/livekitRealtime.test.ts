import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mapAgentState } from '../features/voice/api/livekitVoiceSession';
import { MockVoiceSession } from '../features/voice/api/mockVoiceSession';
import { useVoice, wireVoiceToBus } from '../features/voice';
import { useTrip } from '../features/trip/hooks/useTrip';
import i18n from '../lib/i18n';
import { agentBus } from '../services/agentBus';
import { useApiConfig } from '../services/api';
import { handleStreamMessage } from '../services/backendStream';
import { httpApiClient } from '../services/httpApi';

vi.mock('react-native', () => ({}));
vi.mock('react-native-reanimated', () => ({
  default: { View: () => null },
  cancelAnimation: vi.fn(),
  Easing: {
    inOut: (value: unknown) => value,
    linear: 'linear',
    sin: 'sin',
  },
  useAnimatedStyle: () => ({}),
  useSharedValue: (value: number) => ({ value }),
  withRepeat: (animation: unknown) => animation,
  withSequence: (...animations: unknown[]) => animations[0],
  withSpring: (value: number) => value,
  withTiming: (value: number) => value,
}));
vi.mock('react-native-svg', () => ({
  default: () => null,
  Path: () => null,
  Circle: () => null,
  Line: () => null,
  Polyline: () => null,
  Rect: () => null,
}));

describe('LiveKit Agents real-time voice & backend sync (v1.0-entrega)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR');
    useApiConfig.setState({
      mode: 'mock',
      baseUrl: 'http://localhost:8000',
      rotaId: 1,
      driverId: 1,
      recentUrls: ['http://localhost:8000'],
    });
    useTrip.getState().reset();
    useVoice.getState().reset();
  });

  it('mapeia o atributo `lk.agent.state` do agente LiveKit para o VoiceState visual do app', () => {
    expect(mapAgentState('listening')).toBe('listening');
    expect(mapAgentState('thinking')).toBe('thinking');
    expect(mapAgentState('speaking')).toBe('speaking');
    expect(mapAgentState('idle')).toBe('idle');
    // `initializing` (sem equivalente visual direto) é tratado como "pensando".
    expect(mapAgentState('initializing')).toBe('thinking');
    // Maiúsculas/espaços não quebram o mapeamento.
    expect(mapAgentState('  SPEAKING  ')).toBe('speaking');
    // Valor desconhecido ou ausente não força transição de estado.
    expect(mapAgentState('away')).toBeNull();
    expect(mapAgentState(undefined)).toBeNull();
  });

  it('canal "fala" no WebSocket não cria transcrição nem dispara comando do motorista', () => {
    handleStreamMessage(
      JSON.stringify({
        canal: 'fala',
        dado: {
          rota_id: 1,
          papel: 'motorista',
          texto: 'Iniciei a viagem e avisei o recebedor que você está a caminho.',
        },
      }),
    );

    const { transcript } = useVoice.getState();
    expect(transcript).toHaveLength(0);
    // Não deve ter disparado o comando "Iniciar viagem" do motorista
    expect(useTrip.getState().phase).toBe('idle');
  });

  it('não vaza TTS local nem legendas em modo LiveKit e auto-habilita HTTP no listen()', async () => {
    const mockSaySpy = vi.spyOn(MockVoiceSession.prototype, 'say');
    const unsub = wireVoiceToBus();

    try {
      await useVoice.getState().setVoiceMode('livekit');
      expect(useVoice.getState().preferredMode).toBe('livekit');

      // Emitir agent:say em modo LiveKit desconectado NÃO pode chamar MockVoiceSession.say
      // nem gravar legenda no cliente.
      agentBus.emit('agent:say', { text: 'Fala do agente durante modo LiveKit' });
      expect(mockSaySpy).not.toHaveBeenCalled();
      expect(useVoice.getState().transcript).toHaveLength(0);

      // Datastream e WebSocket também não podem alimentar o histórico de legendas.
      useVoice.getState().pushTranscript('agent', 'Fala do agente durante modo LiveKit');
      expect(useVoice.getState().transcript).toHaveLength(0);

      // listen() com preferredMode === 'livekit' e baseUrl configurada deve alternar useApiConfig.mode para 'http'
      expect(useApiConfig.getState().mode).toBe('mock');
      useVoice.getState().listen();
      expect(useApiConfig.getState().mode).toBe('http');
    } finally {
      unsub();
      mockSaySpy.mockRestore();
    }
  });

  it('httpApiClient.checkHealth() lê llm_mode, llm_upstream e recebedor_modo do /health', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          public_url: 'https://avisai.trycloudflare.com',
          livekit_configurada: true,
          llm_mode: 'custom',
          llm_upstream: true,
          recebedor_modo: 'rtc',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    try {
      const res = await httpApiClient.checkHealth();
      expect(res).toEqual({
        ok: true,
        publicUrl: 'https://avisai.trycloudflare.com',
        livekitConfigured: true,
        llmMode: 'custom',
        llmUpstream: true,
        receiverMode: 'rtc',
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
