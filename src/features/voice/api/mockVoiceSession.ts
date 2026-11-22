import { VOICE_PRIVACY } from '../../../lib/config';
import { getCurrentLanguage } from '../../../lib/i18n';
import type { VoiceState } from '../types';
import type { VoiceSession, VoiceSessionCallbacks } from './voiceSession';

function loadSpeech(): typeof import('expo-speech') | null {
  if (process.env.VITEST) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-speech') as typeof import('expo-speech');
  } catch {
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
 * Implementação Mock de `VoiceSession`:
 * - Usa `expo-speech` para síntese de voz (TTS) em `pt-BR` ou `en-US`.
 * - Cancela todos os timers em `interrupt()` e `stop()` para evitar race conditions.
 * - Aguarda `await Speech.stop()` antes de `Speech.speak()` e trata `onError` para nunca travar em `speaking`.
 * - Não grava áudio bruto.
 */
export class MockVoiceSession implements VoiceSession {
  readonly mode = 'mock' as const;
  readonly privacy = VOICE_PRIVACY;
  private callbacks: VoiceSessionCallbacks = noopCallbacks;
  private currentState: VoiceState = 'idle';
  private interruptTimer: ReturnType<typeof setTimeout> | null = null;
  private volumeTimer: ReturnType<typeof setInterval> | null = null;
  private volumePhase = 0;
  private speakGen = 0;

  private updateVolumeSimulation(state: VoiceState) {
    if (this.volumeTimer) {
      clearInterval(this.volumeTimer);
      this.volumeTimer = null;
    }
    if (state === 'listening' || state === 'speaking') {
      const speaker = state === 'speaking' ? 'agent' : 'driver';
      const baseLevel = state === 'speaking' ? 0.65 : 0.5;
      this.callbacks.onVolume?.(baseLevel, speaker);
      if (!process.env.VITEST) {
        this.volumeTimer = setInterval(() => {
          this.volumePhase += 0.65;
          const wave = Math.sin(this.volumePhase) * 0.25 + Math.cos(this.volumePhase * 1.7) * 0.12;
          const level = Math.min(1, Math.max(0.18, baseLevel + wave));
          this.callbacks.onVolume?.(level, speaker);
        }, 160);
      }
    } else {
      this.callbacks.onVolume?.(0, 'none');
    }
  }

  private setState(state: VoiceState) {
    this.currentState = state;
    this.updateVolumeSimulation(state);
    this.callbacks.onStateChange(state);
  }

  private clearTimers() {
    if (this.interruptTimer) {
      clearTimeout(this.interruptTimer);
      this.interruptTimer = null;
    }
    if (this.volumeTimer) {
      clearInterval(this.volumeTimer);
      this.volumeTimer = null;
    }
  }

  async start(_channel: string, callbacks?: VoiceSessionCallbacks): Promise<void> {
    if (callbacks) this.callbacks = callbacks;
    this.clearTimers();
    this.setState('idle');
  }

  setCallbacks(callbacks: VoiceSessionCallbacks) {
    this.callbacks = callbacks;
  }

  async listen(): Promise<void> {
    this.clearTimers();
    this.setState('listening');
  }

  async stopListening(): Promise<void> {
    this.clearTimers();
    this.setState('idle');
  }

  async say(text: string): Promise<void> {
    this.clearTimers();
    if (!text) {
      this.setState('idle');
      return;
    }
    const myGen = ++this.speakGen;
    this.callbacks.onTranscript('agent', text);
    this.setState('speaking');

    const Speech = loadSpeech();
    try {
      await Speech?.stop();
    } catch {
      // Ignora erro caso TTS não esteja ativo no ambiente
    }

    if (myGen !== this.speakGen) return;

    try {
      if (!Speech) {
        this.setState('idle');
        return;
      }
      Speech.speak(text, {
        language: getCurrentLanguage() === 'en' ? 'en-US' : 'pt-BR',
        onDone: () => {
          if (myGen === this.speakGen && this.currentState === 'speaking') {
            this.setState('idle');
          }
        },
        onStopped: () => undefined,
        onError: () => {
          if (myGen === this.speakGen && this.currentState === 'speaking') {
            this.setState('idle');
          }
        },
      });
    } catch {
      if (myGen === this.speakGen && this.currentState === 'speaking') {
        this.setState('idle');
      }
    }
  }

  async interrupt(): Promise<void> {
    this.clearTimers();
    this.speakGen += 1;
    try {
      await loadSpeech()?.stop();
    } catch {
      // Ignora erro caso TTS não esteja ativo
    }
    this.setState('interrupted');
    this.interruptTimer = setTimeout(() => {
      this.interruptTimer = null;
      this.setState('listening');
    }, 400);
  }

  async stop(): Promise<void> {
    this.clearTimers();
    this.speakGen += 1;
    try {
      await loadSpeech()?.stop();
    } catch {
      // Ignora erro caso TTS não esteja ativo
    }
    this.setState('idle');
  }
}

export const mockVoiceSession = new MockVoiceSession();
