import { create } from 'zustand';
import i18n from '../../../lib/i18n';
import { ENV, type VoiceMode } from '../../../lib/config';
import { getSetting, setSetting } from '../../../lib/db';
import { newId } from '../../../lib/id';
import { agentBus } from '../../../services/agentBus';
import { useApiConfig } from '../../../services/api';
import { useNetwork } from '../../../services/network';
import { tryExecuteVoiceCommand } from '../../../services/voiceCommands';
import { hapticBargeIn } from '../../../utils/haptics';
import type { FieldKey, ReportContext } from '../../report';
import { agentRespond } from '../api/agentMock';
import { MockVoiceSession } from '../api/mockVoiceSession';
import { OfflineVoiceRecorder } from '../api/offlineVoiceRecorder';
import { createAndStartVoiceSession, getAgoraFallbackReason } from '../api/voiceFactory';
import type {
  AgoraStage,
  AudioRouteType,
  AudioSpeaker,
  VoiceSession,
  VoiceSessionCallbacks,
} from '../api/voiceSession';
import type { TranscriptLine, VoiceState } from '../types';

interface VoiceStore {
  state: VoiceState;
  context: ReportContext;
  collected: Partial<Record<FieldKey, string>>;
  transcript: TranscriptLine[];
  /** Latência medida (ms) do fim da fala até o início da resposta. */
  lastLatencyMs: number | null;
  preferredMode: VoiceMode;
  activeMode: VoiceMode;
  fallbackReason: string | null;
  agoraStage: AgoraStage;
  agoraChannel: string | null;
  lastError: string | null;
  /** Em modo `agora`, indica se a sessão RTC (/sessions) está conectada. */
  sessionConnected: boolean;
  /**
   * Sem rede (offline-first): o app grava cada fala em áudio e põe na fila; o servidor transcreve e
   * o agente processa quando a rede volta. Nenhum modelo de voz roda no aparelho.
   */
  offlineRecordingActive: boolean;
  /** Em modo `agora`, indica se o microfone local está em mudo. */
  muted: boolean;
  /** Nível de volume normalizado (0..1) do microfone ou agente. */
  audioLevel: number;
  /** Quem está emitindo áudio no momento (motorista, agente ou silêncio). */
  audioSpeaker: AudioSpeaker;
  /** Rota de áudio ativa reportada pela Agora (viva-voz, bluetooth ou fone). */
  audioRoute: AudioRouteType;
  /** Banner visual temporário (1800 ms) indicando barge-in acionado. */
  bargeInBanner: boolean;
  /** Legenda parcial em tempo real (stream de chunks Agora ConvoAI) antes da frase finalizar. */
  liveTranscript: { who: 'driver' | 'agent'; text: string } | null;
  /** Modo LLM reportado pela sessão ativa no backend (`custom`, `realtime`, `mllm`, etc.). */
  backendLlmMode: string | null;
  clearError: () => void;
  connectAgoraNow: () => Promise<void>;
  startOfflineRecording: () => Promise<void>;
  listen: () => void;
  utter: (text: string) => void;
  say: (text: string) => void;
  interrupt: () => void;
  toggleMute: () => void;
  stop: () => void;
  reset: () => void;
  setContext: (c: ReportContext) => void;
  setVoiceMode: (mode: VoiceMode) => Promise<void>;
  pushTranscript: (who: 'driver' | 'agent', text: string) => void;
}

let lastPushedText = '';
let lastPushedWho: 'driver' | 'agent' | null = null;
let lastPushedAt = 0;

const push = (t: TranscriptLine[], who: TranscriptLine['who'], text: string): TranscriptLine[] => {
  const clean = text.trim();
  if (!clean) return t;
  const now = Date.now();
  if (clean === lastPushedText && who === lastPushedWho && now - lastPushedAt < 4000) {
    return t;
  }
  lastPushedText = clean;
  lastPushedWho = who;
  lastPushedAt = now;
  return [...t, { id: newId(), who, text: clean }].slice(-30);
};

let thinkTimer: ReturnType<typeof setTimeout> | null = null;
let bargeInTimer: ReturnType<typeof setTimeout> | null = null;

function clearThinkTimer() {
  if (thinkTimer) {
    clearTimeout(thinkTimer);
    thinkTimer = null;
  }
}

function clearBargeInTimer() {
  if (bargeInTimer) {
    clearTimeout(bargeInTimer);
    bargeInTimer = null;
  }
}

const initialMockSession = new MockVoiceSession();
let activeSession: VoiceSession = initialMockSession;
let startingAgora = false;
let offlineRecorder: OfflineVoiceRecorder | null = null;
/** A primeira fala guardada explica o que acontece; as seguintes só confirmam. */
let offlineAckedOnce = false;
let startingOfflineRecording = false;
let resumeOfflineAfterReply = false;
let voiceSessionGeneration = 0;

export const useVoice = create<VoiceStore>((set, get) => {
  const usesDirectVoice = () => {
    const { activeMode, preferredMode, offlineRecordingActive } = get();
    return !offlineRecordingActive && (activeMode === 'agora' || preferredMode === 'agora');
  };

  const resumeOfflineListening = () => {
    if (!get().offlineRecordingActive || !offlineRecorder) return;
    void offlineRecorder
      .startListening()
      .then(() => set({ state: 'listening', muted: false, lastError: null }))
      .catch((error) =>
        set({ state: 'idle', lastError: error instanceof Error ? error.message : String(error) }),
      );
  };

  const triggerBargeInFeedback = () => {
    clearBargeInTimer();
    hapticBargeIn();
    set({ bargeInBanner: true });
    bargeInTimer = setTimeout(() => {
      bargeInTimer = null;
      set({ bargeInBanner: false });
    }, 1800);
  };

  const callbacks: VoiceSessionCallbacks = {
    onStateChange: (state) => {
      set((s) => ({
        state,
        liveTranscript:
          usesDirectVoice() || (state === 'interrupted' && s.liveTranscript?.who === 'agent')
            ? null
            : s.liveTranscript,
      }));
      if ((state === 'idle' || state === 'listening') && resumeOfflineAfterReply) {
        resumeOfflineAfterReply = false;
        resumeOfflineListening();
      }
      if (state === 'interrupted') {
        triggerBargeInFeedback();
      }
    },
    onTranscript: (who, text) => {
      if (usesDirectVoice()) return;
      set((s) => ({
        transcript: push(s.transcript, who, text),
        liveTranscript: s.liveTranscript?.who === who ? null : s.liveTranscript,
      }));
      if (who === 'driver') {
        tryExecuteVoiceCommand(text);
      }
    },
    onPartialTranscript: (who, text) => {
      if (usesDirectVoice()) return;
      const clean = text.trim();
      if (!clean) return;
      set({ liveTranscript: { who, text: clean } });
    },
    onSessionMeta: (meta) => {
      set({ backendLlmMode: meta.llmMode ?? null });
    },
    onLatency: (ms) => set({ lastLatencyMs: ms }),
    onError: (msg) => {
      set((s) => ({
        lastError: msg,
        agoraStage: 'error',
        audioLevel: 0,
        audioSpeaker: 'none',
        state: s.state === 'speaking' || s.state === 'thinking' ? 'idle' : s.state,
      }));
    },
    onAgoraStage: (stage, detail) => {
      set((s) => ({
        agoraStage: stage,
        agoraChannel:
          stage === 'disconnected'
            ? null
            : detail && stage !== 'error'
              ? detail
              : s.agoraChannel,
        ...(stage === 'error' && detail ? { lastError: detail } : {}),
        ...(stage === 'live' || stage === 'waiting_agent' ? { lastError: null } : {}),
        ...(stage === 'disconnected'
          ? {
              sessionConnected: false,
              muted: false,
              audioLevel: 0,
              audioSpeaker: 'none' as AudioSpeaker,
              liveTranscript: null,
              state: 'idle' as VoiceState,
            }
          : {}),
      }));
    },
    onModeFallback: (reason) =>
      set({ fallbackReason: reason, sessionConnected: false, muted: false }),
    onVolume: (level, speaker) => set({ audioLevel: level, audioSpeaker: speaker }),
    onAudioRouteChange: (route) => set({ audioRoute: route }),
  };

  initialMockSession.setCallbacks(callbacks);

  return {
    state: 'idle',
    context: 'free',
    collected: {},
    transcript: [],
    lastLatencyMs: null,
    preferredMode: ENV.voiceMode,
    activeMode: ENV.voiceMode === 'agora' ? 'agora' : 'mock',
    fallbackReason: ENV.voiceMode === 'agora' ? getAgoraFallbackReason() : null,
    agoraStage: 'disconnected',
    agoraChannel: null,
    lastError: null,
    sessionConnected: false,
    offlineRecordingActive: false,
    muted: false,
    audioLevel: 0,
    audioSpeaker: 'none',
    audioRoute: 'speaker',
    bargeInBanner: false,
    liveTranscript: null,
    backendLlmMode: null,

    clearError: () => set({ lastError: null }),

    pushTranscript: (who, text) => {
      if (usesDirectVoice()) return;
      set((s) => ({
        transcript: push(s.transcript, who, text),
        liveTranscript: s.liveTranscript?.who === who ? null : s.liveTranscript,
      }));
    },

    connectAgoraNow: async () => {
      if (startingAgora) return;
      voiceSessionGeneration += 1;
      if (offlineRecorder) {
        const localSession = offlineRecorder;
        offlineRecorder = null;
        resumeOfflineAfterReply = false;
        await localSession.stop().catch(() => undefined);
        set({ offlineRecordingActive: false, muted: false });
      }
      setSetting('voice_mode', 'agora');
      const apiState = useApiConfig.getState();
      if (apiState.mode !== 'http' && Boolean(apiState.baseUrl?.trim())) {
        apiState.setMode('http');
      }

      const precheck = getAgoraFallbackReason();
      if (precheck) {
        const errMsg =
          precheck === 'agora_requires_http_api'
            ? 'Agora requer API em modo Backend (HTTP). Ative o Backend no painel Demo.'
            : 'SDK nativo react-native-agora indisponível neste build.';
        set({
          preferredMode: 'agora',
          activeMode: 'agora',
          fallbackReason: precheck,
          agoraStage: 'error',
          lastError: errMsg,
          sessionConnected: false,
          muted: false,
          state: 'idle',
        });
        return;
      }

      startingAgora = true;
      clearThinkTimer();
      const prevSession = activeSession;
      if (prevSession !== initialMockSession) {
        await prevSession.stop().catch(() => undefined);
      }

      set({
        preferredMode: 'agora',
        activeMode: 'agora',
        state: 'thinking',
        fallbackReason: null,
        lastError: null,
        agoraStage: 'connecting',
      });

      try {
        const res = await createAndStartVoiceSession(
          'agora',
          `avisai-rota-${useApiConfig.getState().rotaId}`,
          callbacks,
        );
        if (res.errorMessage) {
          set({
            activeMode: 'agora',
            fallbackReason: res.fallbackReason,
            sessionConnected: false,
            muted: false,
            agoraStage: 'error',
            lastError: res.errorMessage,
            state: 'idle',
          });
        } else {
          activeSession = res.session;
          set({
            activeMode: 'agora',
            fallbackReason: null,
            sessionConnected: true,
            muted: false,
            lastError: null,
          });
        }
      } finally {
        startingAgora = false;
      }
      if (useNetwork.getState().quality() === 'offline' && !get().sessionConnected) {
        void get().startOfflineRecording();
      }
    },

    startOfflineRecording: async () => {
      if (
        startingOfflineRecording ||
        get().offlineRecordingActive ||
        useNetwork.getState().quality() !== 'offline'
      ) {
        return;
      }
      startingOfflineRecording = true;
      const generation = voiceSessionGeneration;
      try {
        const previousSession = activeSession;
        activeSession = initialMockSession;
        initialMockSession.setCallbacks(callbacks);
        if (previousSession !== initialMockSession) {
          await previousSession.stop().catch(() => undefined);
        }
        if (generation !== voiceSessionGeneration) return;

        const session = new OfflineVoiceRecorder({
          onNote: (note) => {
            if (!get().offlineRecordingActive) return;
            agentBus.emit('voice:offline_note', note);
            // Confirma em voz local, sem ouvir a própria confirmação.
            const ack = i18n.t(offlineAckedOnce ? 'voice.offlineAck.next' : 'voice.offlineAck.first');
            offlineAckedOnce = true;
            // Parou a escuta no meio da fala: guarda o trecho, mas não volta a ouvir.
            if (offlineRecorder?.isListening) {
              resumeOfflineAfterReply = true;
              void offlineRecorder.stopListening();
            }
            set((s) => ({ transcript: push(s.transcript, 'driver', i18n.t('trip.timeline.voiceNoteSaved')) }));
            get().say(ack);
          },
          onError: (message) => set({ lastError: message }),
        });
        offlineRecorder = session;
        await session.startListening();
        if (generation !== voiceSessionGeneration) {
          offlineRecorder = null;
          await session.stop();
          return;
        }
        set({
          offlineRecordingActive: true,
          activeMode: 'mock',
          sessionConnected: false,
          muted: false,
          state: 'listening',
          agoraStage: 'disconnected',
          agoraChannel: null,
          fallbackReason: null,
          lastError: null,
        });
      } catch (error) {
        if (generation !== voiceSessionGeneration) return;
        await offlineRecorder?.stop().catch(() => undefined);
        offlineRecorder = null;
        set({
          offlineRecordingActive: false,
          activeMode: 'agora',
          sessionConnected: false,
          state: 'idle',
          lastError: error instanceof Error ? error.message : String(error),
        });
      } finally {
        startingOfflineRecording = false;
      }
    },

    listen: () => {
      const { state: current, preferredMode, sessionConnected, activeMode, offlineRecordingActive } = get();

      if (offlineRecordingActive) {
        if (current === 'speaking') {
          resumeOfflineAfterReply = true;
          get().interrupt();
          return;
        }
        if (current === 'listening') {
          resumeOfflineAfterReply = false;
          void offlineRecorder?.stopListening();
          set({ state: 'idle', muted: false });
          return;
        }
        if (current === 'idle') {
          resumeOfflineListening();
          return;
        }
      }

      // Modo Agora: primeiro toque na esfera do AvisAI inicia a sessão real (POST /sessions + joinChannel)
      if (preferredMode === 'agora' && !sessionConnected) {
        if (useNetwork.getState().quality() === 'offline') {
          void get().startOfflineRecording();
          return;
        }
        void get().connectAgoraNow();
        return;
      }

      // Sessão Agora já conectada: toque durante fala do agente = barge-in; caso contrário alterna mudo
      if (activeMode === 'agora' && sessionConnected) {
        if (current === 'speaking') {
          if (get().muted) {
            activeSession.setMuted?.(false);
            set({ muted: false });
          }
          get().interrupt();
          return;
        }
        get().toggleMute();
        return;
      }

      // Modo Mock padrão
      if (current === 'speaking') {
        get().interrupt();
        return;
      }
      if (current === 'listening') {
        clearThinkTimer();
        void activeSession.stopListening();
        return;
      }
      clearThinkTimer();
      void activeSession.listen();
    },

    toggleMute: () => {
      const nextMuted = !get().muted;
      if (get().offlineRecordingActive) {
        if (nextMuted) {
          resumeOfflineAfterReply = false;
          void offlineRecorder?.stopListening();
          set({ muted: true, state: 'idle' });
        } else {
          resumeOfflineListening();
        }
        return;
      }
      activeSession.setMuted?.(nextMuted);
      set({
        muted: nextMuted,
        state: nextMuted ? 'idle' : 'listening',
      });
    },

    utter: (text) => {
      clearThinkTimer();
      const started = Date.now();
      set((s) => ({
        state: 'thinking',
        transcript: push(s.transcript, 'driver', text),
        liveTranscript: s.liveTranscript?.who === 'driver' ? null : s.liveTranscript,
      }));
      if (get().offlineRecordingActive) {
        resumeOfflineAfterReply = true;
        void offlineRecorder?.stopListening();
      }
      tryExecuteVoiceCommand(text);

      thinkTimer = setTimeout(() => {
        thinkTimer = null;
        const { context, collected } = get();
        const turn = agentRespond(context, text, collected);
        const latency = Date.now() - started;
        set({ collected: turn.collected, lastLatencyMs: latency });

        if (turn.startOccurrence) {
          set({ context: 'occurrence', collected: {} });
        }

        if (turn.occurrence) {
          agentBus.emit('voice:occurrence', turn.occurrence);
          set({ context: 'free', collected: {} });
        }

        if (turn.documentAnswer) {
          agentBus.emit('voice:document_answered', turn.documentAnswer);
        }

        if (turn.missingFields && turn.missingFields.length > 0) {
          agentBus.emit('voice:field_missing', {
            context,
            missing: turn.missingFields,
            collected: turn.collected,
            utterance: text,
          });
        }

        if (turn.completed) {
          const completedContext = context;
          const completedFields = turn.collected as Record<string, string>;
          // Limpa ANTES de emitir `voice:completed`, permitindo que `wireTripToVoice` defina o próximo contexto (ex.: `checkin` -> `unload`) sem ser sobrescrito!
          set({ collected: {}, context: 'free' });
          agentBus.emit('voice:completed', { context: completedContext, fields: completedFields });
        }

        get().say(turn.reply);
      }, 700);
    },

    say: (text) => {
      if (!text) {
        set({ state: 'idle' });
        if (resumeOfflineAfterReply) {
          resumeOfflineAfterReply = false;
          resumeOfflineListening();
        }
        return;
      }
      if (
        get().preferredMode === 'agora' &&
        !get().offlineRecordingActive &&
        activeSession === initialMockSession
      ) {
        get().pushTranscript('agent', text);
        return;
      }
      void activeSession.say(text);
    },

    interrupt: () => {
      clearThinkTimer();
      triggerBargeInFeedback();
      void activeSession.interrupt();
    },

    stop: () => {
      voiceSessionGeneration += 1;
      clearThinkTimer();
      clearBargeInTimer();
      const currentSession = activeSession;
      activeSession = initialMockSession;
      initialMockSession.setCallbacks(callbacks);
      const localSession = offlineRecorder;
      offlineRecorder = null;
      resumeOfflineAfterReply = false;
      void localSession?.stop();
      set({
        sessionConnected: false,
        offlineRecordingActive: false,
        muted: false,
        state: 'idle',
        agoraStage: 'disconnected',
        agoraChannel: null,
        audioLevel: 0,
        audioSpeaker: 'none',
        bargeInBanner: false,
        liveTranscript: null,
        backendLlmMode: null,
      });
      void currentSession.stop();
    },

    reset: () => {
      voiceSessionGeneration += 1;
      clearThinkTimer();
      clearBargeInTimer();
      const currentSession = activeSession;
      activeSession = initialMockSession;
      initialMockSession.setCallbacks(callbacks);
      const localSession = offlineRecorder;
      offlineRecorder = null;
      resumeOfflineAfterReply = false;
      offlineAckedOnce = false;
      void localSession?.stop();
      lastPushedText = '';
      lastPushedWho = null;
      lastPushedAt = 0;
      set({
        state: 'idle',
        context: 'free',
        collected: {},
        transcript: [],
        lastLatencyMs: null,
        sessionConnected: false,
        offlineRecordingActive: false,
        muted: false,
        agoraStage: 'disconnected',
        agoraChannel: null,
        lastError: null,
        audioLevel: 0,
        audioSpeaker: 'none',
        bargeInBanner: false,
        liveTranscript: null,
        backendLlmMode: null,
      });
      void currentSession.stop();
    },

    setContext: (context) => set({ context, collected: {} }),

    setVoiceMode: async (mode: VoiceMode) => {
      voiceSessionGeneration += 1;
      setSetting('voice_mode', mode);
      clearThinkTimer();
      clearBargeInTimer();
      const prevSession = activeSession;
      activeSession = initialMockSession;
      initialMockSession.setCallbacks(callbacks);
      await prevSession.stop();
      const localSession = offlineRecorder;
      offlineRecorder = null;
      resumeOfflineAfterReply = false;
      await localSession?.stop();

      if (mode === 'agora') {
        const reason = getAgoraFallbackReason();
        set({
          preferredMode: 'agora',
          activeMode: 'agora',
          fallbackReason: reason,
          agoraStage: 'disconnected',
          agoraChannel: null,
          lastError: null,
          sessionConnected: false,
          offlineRecordingActive: false,
          muted: false,
          audioLevel: 0,
          audioSpeaker: 'none',
          bargeInBanner: false,
          liveTranscript: null,
          backendLlmMode: null,
          state: 'idle',
        });
        return;
      }

      await initialMockSession.start('rota-1', callbacks);
      set({
        preferredMode: 'mock',
        activeMode: 'mock',
        fallbackReason: null,
        agoraStage: 'disconnected',
        agoraChannel: null,
        lastError: null,
        sessionConnected: false,
        offlineRecordingActive: false,
        muted: false,
        audioLevel: 0,
        audioSpeaker: 'none',
        bargeInBanner: false,
        liveTranscript: null,
        backendLlmMode: null,
        state: 'idle',
      });
    },
  };
});

export function loadPersistedVoiceMode(): void {
  const saved = getSetting('voice_mode');
  if (saved === 'agora' || saved === 'mock') {
    void useVoice.getState().setVoiceMode(saved);
  }
}

/** Liga o agente aos eventos da viagem. Chamar uma vez no bootstrap. */
export function wireVoiceToBus() {
  if (ENV.voiceMode === 'agora') {
    void useVoice.getState().setVoiceMode('agora');
  }
  const unsubApi = useApiConfig.subscribe((apiState, prevApiState) => {
    if (apiState.mode !== prevApiState.mode) {
      const voice = useVoice.getState();
      if (voice.preferredMode === 'agora' && !voice.sessionConnected) {
        const reason = getAgoraFallbackReason();
        useVoice.setState({
          activeMode: 'agora',
          fallbackReason: reason,
        });
      }
    }
  });
  const syncOfflineMode = () => {
    const voice = useVoice.getState();
    if (voice.preferredMode !== 'agora') return;
    if (useNetwork.getState().quality() === 'offline') {
      if (voice.sessionConnected) {
        void voice.startOfflineRecording();
      }
    } else if (voice.offlineRecordingActive) {
      void voice.connectAgoraNow();
    }
  };
  const offNetwork = useNetwork.subscribe((state, previous) => {
    if (state.device !== previous.device || state.override !== previous.override) {
      syncOfflineMode();
    }
  });
  syncOfflineMode();
  const offSay = agentBus.on('agent:say', ({ text }) => {
    const v = useVoice.getState();
    // Em modo Agora (tempo real), nunca reproduz TTS local (expo-speech).
    // O áudio vem exclusivamente do agente no RTC; o app não armazena legendas.
    if (!v.offlineRecordingActive && (v.preferredMode === 'agora' || v.activeMode === 'agora')) {
      return;
    }
    v.say(text);
  });
  const offCtx = agentBus.on('agent:context', ({ context }) => useVoice.getState().setContext(context));
  const offReset = agentBus.on('voice:reset', () => useVoice.getState().reset());
  return () => {
    unsubApi();
    offNetwork();
    offSay();
    offCtx();
    offReset();
  };
}
