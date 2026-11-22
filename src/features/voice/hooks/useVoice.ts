import { create } from 'zustand';
import * as Speech from 'expo-speech';
import i18n from '../../../lib/i18n';
import { newId } from '../../../lib/id';
import { agentBus } from '../../../services/agentBus';
import type { FieldKey, ReportContext } from '../../report';
import { agentRespond } from '../api/agentMock';
import type { TranscriptLine, VoiceState } from '../types';

interface VoiceStore {
  state: VoiceState;
  context: ReportContext;
  collected: Partial<Record<FieldKey, string>>;
  transcript: TranscriptLine[];
  /** Latência medida (ms) do fim da fala até o início da resposta. */
  lastLatencyMs: number | null;
  listen: () => void;
  utter: (text: string) => void;
  say: (text: string) => void;
  interrupt: () => void;
  setContext: (c: ReportContext) => void;
}

const push = (t: TranscriptLine[], who: TranscriptLine['who'], text: string) =>
  [...t, { id: newId(), who, text }].slice(-30);

export const useVoice = create<VoiceStore>((set, get) => ({
  state: 'idle',
  context: 'free',
  collected: {},
  transcript: [],
  lastLatencyMs: null,

  listen: () => {
    if (get().state === 'speaking') return get().interrupt();
    set({ state: 'listening' });
  },

  utter: (text) => {
    const started = Date.now();
    set((s) => ({ state: 'thinking', transcript: push(s.transcript, 'driver', text) }));
    setTimeout(() => {
      const { context, collected } = get();
      const turn = agentRespond(context, text, collected);
      set({ collected: turn.collected, lastLatencyMs: Date.now() - started });
      if (turn.occurrence) agentBus.emit('voice:occurrence', { text: turn.occurrence });
      get().say(turn.reply);
      if (turn.completed) {
        agentBus.emit('voice:completed', { context, fields: turn.collected as Record<string, string> });
        set({ collected: {}, context: 'free' });
      }
    }, 700);
  },

  say: (text) => {
    if (!text) return set({ state: 'idle' });
    set((s) => ({ state: 'speaking', transcript: push(s.transcript, 'agent', text) }));
    Speech.stop();
    Speech.speak(text, {
      language: i18n.language === 'en' ? 'en-US' : 'pt-BR',
      onDone: () => get().state === 'speaking' && set({ state: 'idle' }),
      onStopped: () => undefined,
    });
  },

  interrupt: () => {
    Speech.stop();
    set({ state: 'interrupted' });
    setTimeout(() => set({ state: 'listening' }), 400);
  },

  setContext: (context) => set({ context, collected: {} }),
}));

/** Liga o agente aos eventos da viagem. Chamar uma vez no bootstrap. */
export function wireVoiceToBus() {
  const offSay = agentBus.on('agent:say', ({ text }) => useVoice.getState().say(text));
  const offCtx = agentBus.on('agent:context', ({ context }) => useVoice.getState().setContext(context));
  return () => {
    offSay();
    offCtx();
  };
}
