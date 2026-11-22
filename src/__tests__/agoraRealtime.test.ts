import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { AgoraStreamParser } from '../features/voice/api/agoraStreamParser';
import { MockVoiceSession } from '../features/voice/api/mockVoiceSession';
import { useVoice, wireVoiceToBus } from '../features/voice';
import { useTrip } from '../features/trip/hooks/useTrip';
import i18n from '../lib/i18n';
import { agentBus } from '../services/agentBus';
import { useApiConfig } from '../services/api';
import { handleStreamMessage } from '../services/backendStream';
import { httpApiClient } from '../services/httpApi';

function toBase64(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64');
}

describe('Agora Conversational AI real-time streaming & backend sync (v1.0-entrega)', () => {
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

  it('decodifica chunks base64 single-part e multi-part da Agora ConvoAI em ordem', () => {
    const parser = new AgoraStreamParser();

    // 1. Single-part user.transcription (parcial e final)
    const partialUserJson = JSON.stringify({
      object: 'user.transcription',
      text: 'Cheguei na portaria',
      final: false,
      turn_id: 42,
    });
    const ev1 = parser.parse(`msg-1|1|1|${toBase64(partialUserJson)}`);
    expect(ev1).toEqual({
      kind: 'transcript',
      who: 'driver',
      text: 'Cheguei na portaria',
      isFinal: false,
      turnId: '42',
    });

    // 2. Multi-part assistant.transcription com acentuação UTF-8 (turn_status = 0 parcial, 1 final, 2 interrompido)
    const agentFullJson = JSON.stringify({
      object: 'assistant.transcription',
      text: 'Olá Carlos! Check-in registrado na doca 4, previsão de descarga às 14h30.',
      turn_status: 1,
      turn_id: 43,
      latency_ms: 310,
    });
    const fullB64 = toBase64(agentFullJson);
    const mid = Math.floor(fullB64.length / 2);
    const part1 = `msg-2|1|2|${fullB64.slice(0, mid)}`;
    const part2 = `msg-2|2|2|${fullB64.slice(mid)}`;

    // Recebendo fora de ordem (parte 2 antes da parte 1)
    expect(parser.parse(new TextEncoder().encode(part2))).toBeNull();
    const ev2 = parser.parse(new TextEncoder().encode(part1));
    expect(ev2).toEqual({
      kind: 'transcript',
      who: 'agent',
      text: 'Olá Carlos! Check-in registrado na doca 4, previsão de descarga às 14h30.',
      isFinal: true,
      interrupted: false,
      turnId: '43',
      latencyMs: 310,
    });

    // 3. assistant.transcription em streaming (turn_status = 0 -> isFinal: false) e interrompido (turn_status = 2)
    const streamingAgent = parser.parse(
      JSON.stringify({
        object: 'assistant.transcription',
        text: 'Consultando a nota fiscal',
        turn_status: 0,
        turn_id: 44,
      }),
    );
    expect(streamingAgent).toEqual({
      kind: 'transcript',
      who: 'agent',
      text: 'Consultando a nota fiscal',
      isFinal: false,
      interrupted: false,
      turnId: '44',
    });

    const interruptedAgent = parser.parse(
      JSON.stringify({
        object: 'assistant.transcription',
        text: 'Consultando a nota fiscal...',
        turn_status: 2,
        turn_id: 44,
      }),
    );
    expect(interruptedAgent).toEqual({
      kind: 'transcript',
      who: 'agent',
      text: 'Consultando a nota fiscal...',
      isFinal: true,
      interrupted: true,
      turnId: '44',
    });

    // 4. message.state, message.interrupt, message.metrics e fallback flat JSON
    expect(
      parser.parse(`msg-3|1|1|${toBase64(JSON.stringify({ object: 'message.state', state: 'speaking' }))}`),
    ).toEqual({ kind: 'state', state: 'speaking' });
    expect(
      parser.parse(JSON.stringify({ object: 'message.state', state: 'silent' })),
    ).toEqual({ kind: 'state', state: 'idle' });
    expect(
      parser.parse(JSON.stringify({ object: 'message.interrupt', turn_id: 44 })),
    ).toEqual({ kind: 'interrupt', turnId: '44' });
    expect(
      parser.parse(JSON.stringify({ object: 'message.metrics', latency_ms: 420 })),
    ).toEqual({ kind: 'metrics', latencyMs: 420 });
    expect(
      parser.parse(JSON.stringify({ speaker: 'driver', text: 'Abrir mapa', isFinal: true })),
    ).toEqual({
      kind: 'transcript',
      who: 'driver',
      text: 'Abrir mapa',
      isFinal: true,
    });
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

  it('não vaza TTS local nem legendas em modo Agora e auto-habilita HTTP no listen()', async () => {
    const mockSaySpy = vi.spyOn(MockVoiceSession.prototype, 'say');
    const unsub = wireVoiceToBus();

    try {
      await useVoice.getState().setVoiceMode('agora');
      expect(useVoice.getState().preferredMode).toBe('agora');

      // Emitir agent:say em modo Agora desconectado NÃO pode chamar MockVoiceSession.say
      // nem gravar legenda no cliente.
      agentBus.emit('agent:say', { text: 'Fala do agente durante modo Agora' });
      expect(mockSaySpy).not.toHaveBeenCalled();
      expect(useVoice.getState().transcript).toHaveLength(0);

      // Datastream e WebSocket também não podem alimentar o histórico de legendas.
      useVoice.getState().pushTranscript('agent', 'Fala do agente durante modo Agora');
      expect(useVoice.getState().transcript).toHaveLength(0);

      // listen() com preferredMode === 'agora' e baseUrl configurada deve alternar useApiConfig.mode para 'http'
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
          agora_configurada: true,
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
        agoraConfigured: true,
        llmMode: 'custom',
        llmUpstream: true,
        receiverMode: 'rtc',
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
