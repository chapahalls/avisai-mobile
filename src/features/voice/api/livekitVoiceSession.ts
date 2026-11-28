import { VOICE_PRIVACY } from '../../../lib/config';
import { getApiClient, useApiConfig } from '../../../services/api';
import type { Sessao } from '../../../types/backend';
import type { VoiceState } from '../types';
import type { AudioSpeaker, VoiceSession, VoiceSessionCallbacks } from './voiceSession';

type LiveKitClientModule = typeof import('livekit-client');
type LiveKitReactNativeModule = typeof import('@livekit/react-native');
type Room = import('livekit-client').Room;
type Participant = import('livekit-client').Participant;
type RemoteParticipant = import('livekit-client').RemoteParticipant;

function loadLiveKitModules(): { client: LiveKitClientModule; rn: LiveKitReactNativeModule } | null {
  if (process.env.VITEST) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('@livekit/react-native') as LiveKitReactNativeModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const client = require('livekit-client') as LiveKitClientModule;
    if (!rn || typeof rn.registerGlobals !== 'function' || !client || typeof client.Room !== 'function') {
      return null;
    }
    return { client, rn };
  } catch {
    return null;
  }
}

let globalsRegistered = false;

/** `registerGlobals()` só pode ser chamado uma vez por processo. */
function ensureGlobalsRegistered(rn: LiveKitReactNativeModule): void {
  if (globalsRegistered) return;
  rn.registerGlobals();
  globalsRegistered = true;
}

async function requestAndroidMicPermission(): Promise<boolean> {
  if (process.env.VITEST) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PermissionsAndroid, Platform } = require('react-native') as typeof import('react-native');
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return true;
  }
}

export function isLiveKitNativeAvailable(): boolean {
  return loadLiveKitModules() !== null;
}

/** Mapeia `lk.agent.state` (atributo do participante do agente LiveKit) para o VoiceState visual do app. */
export function mapAgentState(raw: unknown): VoiceState | null {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  switch (s) {
    case 'listening':
      return 'listening';
    case 'initializing':
    case 'thinking':
      return 'thinking';
    case 'speaking':
      return 'speaking';
    case 'idle':
      return 'idle';
    default:
      return null;
  }
}

const noopCallbacks: VoiceSessionCallbacks = {
  onStateChange: () => undefined,
  onTranscript: () => undefined,
  onLatency: () => undefined,
  onError: () => undefined,
};

/**
 * Sessão de voz real usando `@livekit/react-native` + `livekit-client`, contra o agente
 * conversacional LiveKit Agents do backend.
 * - Voz RTC direta, sem legendas ou comandos baseados em transcrição no cliente.
 * - Nunca invoca APIs de gravação de áudio bruto.
 * - A sala é sempre motorista + agente (1:1): qualquer `RemoteParticipant` é o agente, sem
 *   comparar identidade/uid como fazia a Agora.
 */
export class LiveKitVoiceSession implements VoiceSession {
  readonly mode = 'livekit' as const;
  readonly privacy = VOICE_PRIVACY;
  private callbacks: VoiceSessionCallbacks = noopCallbacks;
  private modules: { client: LiveKitClientModule; rn: LiveKitReactNativeModule } | null = null;
  private room: Room | null = null;
  private currentState: VoiceState = 'idle';
  private sessao: Sessao | null = null;
  private muted = false;
  private agentPresent = false;
  private stopping = false;

  private setState(state: VoiceState) {
    this.currentState = state;
    this.callbacks.onStateChange(state);
  }

  setCallbacks(callbacks: VoiceSessionCallbacks) {
    this.callbacks = callbacks;
  }

  async start(_channel: string, callbacks?: VoiceSessionCallbacks): Promise<void> {
    if (callbacks) this.callbacks = callbacks;
    this.agentPresent = false;
    this.stopping = false;

    try {
      const modules = loadLiveKitModules();
      if (!modules) {
        this.callbacks.onModeFallback?.('livekit_native_unavailable');
        throw new Error('livekit_native_unavailable: SDK nativo @livekit/react-native não encontrado');
      }
      ensureGlobalsRegistered(modules.rn);

      const hasPermission = await requestAndroidMicPermission();
      if (!hasPermission) {
        this.callbacks.onModeFallback?.('livekit_permission_denied');
        throw new Error('livekit_permission_denied: permissão de microfone negada no Android');
      }

      this.callbacks.onLiveKitStage?.('connecting');
      const rotaId = useApiConfig.getState().rotaId;
      const sessao = await getApiClient().createSession(rotaId);
      this.callbacks.onSessionMeta?.({ llmMode: sessao.llm_mode });
      if (!sessao.livekit_url || !sessao.identity || !sessao.token) {
        throw new Error('POST /sessions retornou sem livekit_url, identity ou token do LiveKit');
      }

      await modules.rn.AudioSession.startAudioSession();

      const { client } = modules;
      const room = new client.Room();

      room.on(client.RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        this.handleAgentJoined(participant);
      });
      room.on(client.RoomEvent.ParticipantDisconnected, () => {
        this.agentPresent = false;
        // O agente encerrou pelo backend (por exemplo, após "AvisAI, encerrar sessão").
        // Fecha só o RTC local: não chama DELETE novamente.
        void this.close(false);
      });
      room.on(
        client.RoomEvent.ParticipantAttributesChanged,
        (changed: Record<string, string>, participant: Participant) => {
          if (participant.isLocal) return;
          this.applyAgentAttributes(changed);
        },
      );
      room.on(client.RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        this.handleActiveSpeakers(speakers);
      });
      room.on(client.RoomEvent.Disconnected, () => {
        void this.close(false);
      });

      room.registerTextStreamHandler('lk.transcription', async (reader) => {
        // Não exibe, armazena nem aciona comportamento a partir de transcrições (VOICE_PRIVACY).
        await reader.readAll().catch(() => undefined);
      });

      this.sessao = sessao;
      this.muted = false;
      this.room = room;
      this.modules = modules;

      await room.connect(sessao.livekit_url, sessao.token);
      await room.localParticipant.setMicrophoneEnabled(true);

      this.callbacks.onLiveKitStage?.('waiting_agent', sessao.canal);
      for (const participant of room.remoteParticipants.values()) {
        this.handleAgentJoined(participant);
      }
      // O 200 do /sessions despacha o agente; aguardamos ParticipantConnected para mudar para 'listening'.
      this.setState('thinking');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.callbacks.onLiveKitStage?.('error', msg);
      this.callbacks.onError(msg);
      throw err instanceof Error ? err : new Error(msg);
    }
  }

  private handleAgentJoined(participant: RemoteParticipant) {
    this.agentPresent = true;
    this.callbacks.onLiveKitStage?.('live', this.sessao?.canal);
    if (!this.muted && (this.currentState === 'thinking' || this.currentState === 'idle')) {
      this.setState('listening');
    }
    this.applyAgentAttributes(participant.attributes);
  }

  private applyAgentAttributes(attrs: Record<string, string> | undefined) {
    if (!attrs) return;
    const mapped = mapAgentState(attrs['lk.agent.state']);
    if (mapped) this.setState(mapped);
  }

  private handleActiveSpeakers(speakers: Participant[]) {
    let peakLevel = 0;
    let peakSpeaker: AudioSpeaker = 'none';
    for (const p of speakers) {
      const level = p.audioLevel ?? 0;
      if (p.isLocal) {
        if (!this.muted && level > peakLevel) {
          peakLevel = level;
          peakSpeaker = 'driver';
        }
      } else if (level > peakLevel) {
        peakLevel = level;
        peakSpeaker = 'agent';
      }
    }
    this.callbacks.onVolume?.(Math.min(1, Math.max(0, peakLevel)), peakSpeaker);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    void this.room?.localParticipant.setMicrophoneEnabled(!muted);
    if (muted) {
      this.callbacks.onVolume?.(0, 'none');
    }
  }

  async listen(): Promise<void> {
    this.muted = false;
    await this.room?.localParticipant.setMicrophoneEnabled(true);
    this.setState('listening');
  }

  async stopListening(): Promise<void> {
    this.muted = true;
    await this.room?.localParticipant.setMicrophoneEnabled(false);
    this.callbacks.onVolume?.(0, 'none');
    this.setState('idle');
  }

  async say(text: string): Promise<void> {
    if (!text) return;
    if (this.sessao) {
      const mode = this.sessao.llm_mode?.toLowerCase() ?? '';
      if (mode === 'live' || mode === 'realtime' || mode === 'mllm') {
        return;
      }
      await getApiClient()
        .speak(this.sessao.id, text, 'APPEND')
        .catch(() => undefined);
    } else {
      this.callbacks.onError('sessão de voz direta não conectada');
    }
  }

  async interrupt(): Promise<void> {
    // O agente (LiveKit Agents) é a fonte de verdade para o barge-in: trata a interrupção
    // internamente. Não forçamos microfone aberto nem retorno automático a "listening".
    this.setState('interrupted');
  }

  async stop(): Promise<void> {
    await this.close(true);
  }

  private async close(deleteRemote: boolean): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    const sessao = this.sessao;
    const modules = this.modules;
    this.sessao = null;
    this.muted = false;
    this.agentPresent = false;

    if (this.room) {
      try {
        await this.room.disconnect();
      } catch {
        // Garante cleanup sem propagar exceção
      }
    }
    this.room = null;
    this.modules = null;

    try {
      await modules?.rn.AudioSession.stopAudioSession();
    } catch {
      // Garante cleanup sem propagar exceção
    }

    this.callbacks.onVolume?.(0, 'none');
    this.callbacks.onLiveKitStage?.('disconnected');
    this.setState('idle');

    try {
      if (deleteRemote && sessao) {
        try {
          await getApiClient().deleteSession(sessao.id);
        } catch {
          // Ignora falha de rede ao encerrar sessão remota
        }
      }
    } finally {
      this.stopping = false;
    }
  }
}

export const livekitVoiceSession = new LiveKitVoiceSession();
