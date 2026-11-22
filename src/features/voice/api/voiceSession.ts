import type { VoiceMode } from '../../../lib/config';
import type { VoiceState } from '../types';

export type AgoraStage = 'connecting' | 'waiting_agent' | 'live' | 'disconnected' | 'error';
export type AudioSpeaker = 'driver' | 'agent' | 'none';
export type AudioRouteType = 'speaker' | 'bluetooth' | 'headset';

export interface VoiceSessionCallbacks {
  onStateChange: (state: VoiceState) => void;
  onTranscript: (who: 'driver' | 'agent', text: string) => void;
  onPartialTranscript?: (who: 'driver' | 'agent', text: string, turnId?: string) => void;
  onSessionMeta?: (meta: { llmMode?: string }) => void;
  onLatency: (ms: number) => void;
  onError: (message: string) => void;
  onModeFallback?: (reason: string) => void;
  onAgoraStage?: (stage: AgoraStage, detail?: string) => void;
  onVolume?: (level: number, speaker: AudioSpeaker) => void;
  onAudioRouteChange?: (route: AudioRouteType) => void;
}

/**
 * Contrato de sessão de voz:
 * - `mock`: TTS local via `expo-speech` + falas rápidas (chips) + barge-in.
 * - `agora`: canal RTC real via `react-native-agora` + Conversational AI Engine da Agora.
 * O cliente não grava áudio nem consome/mostra legendas do canal RTC.
 */
export interface VoiceSession {
  readonly mode: VoiceMode;
  start(channel: string, callbacks?: VoiceSessionCallbacks): Promise<void>;
  stop(): Promise<void>;
  listen(): Promise<void>;
  stopListening(): Promise<void>;
  /** Barge-in: o motorista fala por cima e o agente para imediatamente. */
  interrupt(): Promise<void> | void;
  say(text: string): Promise<void>;
  setMuted?(muted: boolean): void;
}
