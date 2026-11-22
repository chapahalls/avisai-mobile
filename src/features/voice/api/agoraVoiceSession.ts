import { VOICE_PRIVACY } from '../../../lib/config';
import { getApiClient, useApiConfig } from '../../../services/api';
import type { Sessao } from '../../../types/backend';
import type { VoiceState } from '../types';
import { AgoraStreamParser } from './agoraStreamParser';
import type {
  AudioRouteType,
  AudioSpeaker,
  VoiceSession,
  VoiceSessionCallbacks,
} from './voiceSession';

type AgoraModule = typeof import('react-native-agora');
type IRtcEngine = import('react-native-agora').IRtcEngine;
type IRtcEngineEventHandler = import('react-native-agora').IRtcEngineEventHandler;

function loadAgoraModule(): AgoraModule | null {
  if (process.env.VITEST) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-agora') as AgoraModule & {
      default?: AgoraModule['createAgoraRtcEngine'];
    };
    if (
      mod &&
      (typeof mod.createAgoraRtcEngine === 'function' || typeof mod.default === 'function')
    ) {
      return mod;
    }
    return null;
  } catch {
    return null;
  }
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

export function isAgoraNativeAvailable(): boolean {
  return loadAgoraModule() !== null;
}

/**
 * Parâmetros de áudio recomendados pela Agora para agentes de voz (/en/ai/best-practices/audio-setup),
 * conforme implementado no useAvisaiVoz.ts oficial.
 */
function aplicarAudioIA(engine: IRtcEngine, rota: number, agora: AgoraModule) {
  const p = (o: Record<string, unknown>) => engine.setParameters(JSON.stringify(o));
  p({ 'che.audio.aec.split_srate_for_48k': 16000 });
  p({ 'che.audio.sf.enabled': true });
  p({ 'che.audio.sf.stftType': 6 });
  p({ 'che.audio.sf.ainlpLowLatencyFlag': 1 });
  p({ 'che.audio.sf.ainsLowLatencyFlag': 1 });
  p({ 'che.audio.sf.procChainMode': 1 });
  p({ 'che.audio.sf.nlpDynamicMode': 1 });
  const fone = [
    agora.AudioRoute.RouteHeadset,
    agora.AudioRoute.RouteEarpiece,
    agora.AudioRoute.RouteHeadsetnomic,
    agora.AudioRoute.RouteBluetoothDeviceHfp,
    agora.AudioRoute.RouteBluetoothDeviceA2dp,
  ].includes(rota);
  p({ 'che.audio.sf.nlpAlgRoute': fone ? 0 : 1 });
  p({ 'che.audio.sf.ainlpModelPref': 10 });
  p({ 'che.audio.sf.nsngAlgRoute': 12 });
  p({ 'che.audio.sf.ainsModelPref': 10 });
  p({ 'che.audio.sf.nsngPredefAgg': 11 });
  p({ 'che.audio.agc.enable': false });
}

const noopCallbacks: VoiceSessionCallbacks = {
  onStateChange: () => undefined,
  onTranscript: () => undefined,
  onLatency: () => undefined,
  onError: () => undefined,
};

/**
 * Sessão de voz real usando `react-native-agora` + Agora Conversational AI Engine.
 * - Voz RTC direta, sem legendas ou comandos baseados em transcrição no cliente.
 * - Nunca invoca APIs de gravação de áudio bruto (`startAudioRecording`).
 */
export class AgoraVoiceSession implements VoiceSession {
  readonly mode = 'agora' as const;
  readonly privacy = VOICE_PRIVACY;
  private callbacks: VoiceSessionCallbacks = noopCallbacks;
  private engine: IRtcEngine | null = null;
  private eventHandler: IRtcEngineEventHandler | null = null;
  private currentState: VoiceState = 'idle';
  private sessao: Sessao | null = null;
  private muted = false;
  private agentPresent = false;
  private stopping = false;
  private readonly parser = new AgoraStreamParser();

  private setState(state: VoiceState) {
    this.currentState = state;
    this.callbacks.onStateChange(state);
  }

  setCallbacks(callbacks: VoiceSessionCallbacks) {
    this.callbacks = callbacks;
  }

  async start(_channel: string, callbacks?: VoiceSessionCallbacks): Promise<void> {
    if (callbacks) this.callbacks = callbacks;
    this.parser.reset();
    this.agentPresent = false;
    this.stopping = false;

    try {
      const agora = loadAgoraModule();
      if (!agora) {
        this.callbacks.onModeFallback?.('agora_native_unavailable');
        throw new Error('agora_native_unavailable: SDK nativo react-native-agora não encontrado');
      }

      const hasPermission = await requestAndroidMicPermission();
      if (!hasPermission) {
        this.callbacks.onModeFallback?.('agora_permission_denied');
        throw new Error('agora_permission_denied: permissão de microfone negada no Android');
      }

      this.callbacks.onAgoraStage?.('connecting');
      const rotaId = useApiConfig.getState().rotaId;
      const sessao = await getApiClient().createSession(rotaId);
      this.callbacks.onSessionMeta?.({ llmMode: sessao.llm_mode });
      if (!sessao.app_id || !sessao.token) {
        throw new Error('POST /sessions retornou sem app_id ou token da Agora');
      }

      const createEngine =
        typeof agora.createAgoraRtcEngine === 'function'
          ? agora.createAgoraRtcEngine
          : (agora as unknown as { default: AgoraModule['createAgoraRtcEngine'] }).default;

      const engine = createEngine();
      engine.initialize({
        appId: sessao.app_id,
        channelProfile: agora.ChannelProfileType.ChannelProfileLiveBroadcasting,
        audioScenario: agora.AudioScenarioType.AudioScenarioAiClient,
      });
      engine.enableAudio();
      aplicarAudioIA(engine, agora.AudioRoute.RouteDefault, agora);
      engine.setEnableSpeakerphone(true);
      engine.enableAudioVolumeIndication(200, 3, true);

      this.sessao = sessao;
      this.muted = false;

      const handler: IRtcEngineEventHandler = {
        onJoinChannelSuccess: () => {
          const canal = this.sessao?.canal;
          if (this.agentPresent) {
            this.callbacks.onAgoraStage?.('live', canal);
            if (!this.muted && (this.currentState === 'thinking' || this.currentState === 'idle')) {
              this.setState('listening');
            }
          } else {
            this.callbacks.onAgoraStage?.('waiting_agent', canal);
          }
        },
        onConnectionStateChanged: (_connection, state, reason) => {
          const failedState = agora.ConnectionStateType?.ConnectionStateFailed ?? 5;
          const connectedState = agora.ConnectionStateType?.ConnectionStateConnected ?? 3;
          if (state === failedState) {
            const errMsg = `Agora connection failed (state=${state}, reason=${reason})`;
            this.callbacks.onAgoraStage?.('error', errMsg);
            this.callbacks.onError(errMsg);
          } else if (state === connectedState) {
            const canal = this.sessao?.canal;
            if (this.agentPresent) {
              this.callbacks.onAgoraStage?.('live', canal);
            } else {
              this.callbacks.onAgoraStage?.('waiting_agent', canal);
            }
          }
        },
        onUserJoined: (_connection, uid) => {
          if (uid === this.sessao?.agent_uid) {
            this.agentPresent = true;
            this.callbacks.onAgoraStage?.('live', this.sessao?.canal);
            this.setState(this.muted ? 'idle' : 'listening');
          }
        },
        onUserOffline: (_connection, uid) => {
          if (uid === this.sessao?.agent_uid) {
            this.agentPresent = false;
            // O agente encerrou pelo backend (por exemplo, após "AvisAI, encerrar sessão").
            // Fecha só o RTC local: não chama DELETE novamente.
            void this.close(false);
          }
        },
        onTokenPrivilegeWillExpire: () => {
          const s = this.sessao;
          if (!s) return;
          void getApiClient()
            .getVoiceToken({ channel: s.canal, uid: s.user_uid })
            .then((res) => {
              this.engine?.renewToken(res.token);
            })
            .catch((e) => {
              const errMsg = `falha ao renovar token: ${e instanceof Error ? e.message : String(e)}`;
              this.callbacks.onAgoraStage?.('error', errMsg);
              this.callbacks.onError(errMsg);
            });
        },
        onAudioRoutingChanged: (rota) => {
          if (this.engine) {
            aplicarAudioIA(this.engine, rota, agora);
          }
          const isBt = [
            agora.AudioRoute.RouteBluetoothDeviceHfp,
            agora.AudioRoute.RouteBluetoothDeviceA2dp,
          ].includes(rota);
          const isHeadset = [
            agora.AudioRoute.RouteHeadset,
            agora.AudioRoute.RouteEarpiece,
            agora.AudioRoute.RouteHeadsetnomic,
          ].includes(rota);
          const mappedRoute: AudioRouteType = isBt
            ? 'bluetooth'
            : isHeadset
              ? 'headset'
              : 'speaker';
          this.callbacks.onAudioRouteChange?.(mappedRoute);
        },
        onAudioVolumeIndication: (_connection, speakers) => {
          if (!Array.isArray(speakers)) return;
          let peakVol = 0;
          let peakSpeaker: AudioSpeaker = 'none';
          for (const sp of speakers) {
            const vol = sp.volume ?? 0;
            if (sp.uid === this.sessao?.agent_uid) {
              if (vol > peakVol && vol > 10) {
                peakVol = vol;
                peakSpeaker = 'agent';
              }
            } else if (sp.uid === 0) {
              if (vol > peakVol && vol > 10 && !this.muted) {
                peakVol = vol;
                peakSpeaker = 'driver';
              }
            }
          }
          const normalizedLevel = Math.min(1, Math.max(0, peakVol / 255));
          this.callbacks.onVolume?.(normalizedLevel, peakSpeaker);
        },
        onStreamMessage: (_connection, _remoteUid, _streamId, data) => {
          const ev = this.parser.parse(data);
          if (!ev) return;

          switch (ev.kind) {
            case 'state': {
              if (ev.state !== 'idle' && !this.agentPresent) {
                this.agentPresent = true;
                this.callbacks.onAgoraStage?.('live', this.sessao?.canal);
              }
              this.setState(ev.state);
              break;
            }
            case 'interrupt': {
              // A Agora é a fonte de verdade para interrupções. Não desmutamos nem
              // reativamos o microfone local por causa de um evento remoto.
              this.setState('interrupted');
              break;
            }
            case 'metrics': {
              this.callbacks.onLatency(ev.latencyMs);
              break;
            }
            case 'transcript': {
              // Não exibe, armazena nem aciona comportamento a partir de transcrições.
              break;
            }
          }
        },
        onError: (err, msg) => {
          const errMsg = `Agora error ${err}: ${msg || 'agora_rtc_error'}`;
          this.callbacks.onAgoraStage?.('error', errMsg);
          this.callbacks.onError(errMsg);
        },
      };

      engine.registerEventHandler(handler);
      const ret = engine.joinChannel(sessao.token, sessao.canal, sessao.user_uid, {
        clientRoleType: agora.ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: false,
        autoSubscribeAudio: true,
        autoSubscribeVideo: false,
      });
      if (typeof ret === 'number' && ret < 0) {
        try {
          engine.unregisterEventHandler(handler);
          engine.release();
        } catch {
          // Ignora falha de cleanup
        }
        throw new Error(`Agora joinChannel falhou (código ${ret})`);
      }

      this.engine = engine;
      this.eventHandler = handler;
      this.callbacks.onAgoraStage?.('waiting_agent', sessao.canal);
      // O 200 do /sessions cria o agente; aguardamos onUserJoined(9001) para mudar para 'listening'.
      this.setState('thinking');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.callbacks.onAgoraStage?.('error', msg);
      this.callbacks.onError(msg);
      throw err instanceof Error ? err : new Error(msg);
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.engine?.muteLocalAudioStream(muted);
    if (muted) {
      this.callbacks.onVolume?.(0, 'none');
    }
  }

  async listen(): Promise<void> {
    this.muted = false;
    this.engine?.muteLocalAudioStream(false);
    this.setState('listening');
  }

  async stopListening(): Promise<void> {
    this.muted = true;
    this.engine?.muteLocalAudioStream(true);
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
    // Não força microfone aberto nem retorna automaticamente a "listening".
    // O próximo estado vem do agente, evitando o loop por eco/volume.
    this.setState('interrupted');
  }

  async stop(): Promise<void> {
    await this.close(true);
  }

  private async close(deleteRemote: boolean): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    this.parser.reset();
    const sessao = this.sessao;
    this.sessao = null;
    this.muted = false;
    this.agentPresent = false;

    if (this.engine) {
      try {
        this.engine.leaveChannel();
        if (this.eventHandler) {
          this.engine.unregisterEventHandler(this.eventHandler);
        }
        this.engine.release();
      } catch {
        // Garante cleanup sem propagar exceção
      }
    }

    this.engine = null;
    this.eventHandler = null;
    this.callbacks.onVolume?.(0, 'none');
    this.callbacks.onAgoraStage?.('disconnected');
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

export const agoraVoiceSession = new AgoraVoiceSession();
