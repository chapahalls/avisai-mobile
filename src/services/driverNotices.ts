import { AppState } from 'react-native';
import { create } from 'zustand';
import i18n from '../lib/i18n';
import { DRIVER_NOTICES } from '../lib/config';
import type { MensagensStream } from '../types/backend';
import { useAvisaiDock, useVoice } from '../features/voice';
import { useVoiceCommandToast } from './voiceCommands';

export type DriverNotice = MensagensStream['aviso_motorista'];

interface DriverNoticesState {
  /** Falando um aviso em voz local: a wake word pausa para não se ouvir. */
  speaking: boolean;
  /** Documento sendo lido em voz alta pelo botão "Ouvir" (id), ou `null`. */
  readingId: string | null;
}

export const useDriverNotices = create<DriverNoticesState>(() => ({ speaking: false, readingId: null }));

type SpeechModule = typeof import('expo-speech');

function loadSpeech(): SpeechModule | null {
  if (process.env.VITEST) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-speech') as SpeechModule;
  } catch {
    return null;
  }
}

const queue: DriverNotice[] = [];
const seen = new Set<number>();
let busy = false;

/** Abre a conversa para o motorista responder (o agente sabe a pendência pelo estado da rota). */
function openConversation(): void {
  if (AppState.currentState !== 'active') return;
  const voice = useVoice.getState();
  // Voz real (LiveKit): só liga o microfone, sem Painel com frases prontas por cima da tela.
  if (!voice.isDirectVoice()) useAvisaiDock.getState().openPanel();
  voice.listen();
}

function finish(notice: DriverNotice): void {
  setTimeout(() => {
    useDriverNotices.setState({ speaking: false });
    busy = false;
    if (notice.pede_resposta && DRIVER_NOTICES.openConversationOnQuestion) openConversation();
    playNext();
  }, DRIVER_NOTICES.tailMs);
}

function playNext(): void {
  if (busy) return;
  const notice = queue.shift();
  if (!notice) return;
  busy = true;
  useVoiceCommandToast.getState().show(i18n.t('voice.notice.toast', { text: notice.texto }));

  const Speech = loadSpeech();
  if (!Speech) {
    finish(notice);
    return;
  }
  useDriverNotices.setState({ speaking: true });
  Speech.speak(notice.texto, {
    language: i18n.language?.startsWith('en') ? 'en-US' : 'pt-BR',
    onDone: () => finish(notice),
    onStopped: () => finish(notice),
    onError: () => finish(notice),
  });
}

/**
 * Aviso do agente que chegou sem conversa aberta (`aviso_motorista` do `/ws`): o app fala em
 * voz local, sem gastar minutos do LiveKit, e mostra o aviso na tela. Se for pergunta
 * ("A central pergunta…", "Confirma a retirada?"), abre a conversa para a resposta.
 */
export function announceDriverNotice(notice: DriverNotice): boolean {
  if (!notice?.texto?.trim() || seen.has(notice.id)) return false;
  seen.add(notice.id);
  // Conversa aberta: o agente fala pelo LiveKit; aqui seria repetido.
  const voice = useVoice.getState();
  if (voice.sessionConnected || voice.offlineRecordingActive) return false;
  queue.push(notice);
  playNext();
  return true;
}

/**
 * Leitura em voz local de um documento (botão "Ouvir em voz alta" no visualizador). Usa a mesma
 * voz dos avisos, sem gastar minutos do LiveKit, e pausa a wake word para ela não se ouvir.
 */
export function readAloudLocal(id: string, text: string): void {
  const Speech = loadSpeech();
  if (!Speech || !text.trim()) return;
  Speech.stop();
  const done = () => {
    if (useDriverNotices.getState().readingId !== id) return;
    useDriverNotices.setState({ speaking: false, readingId: null });
  };
  useDriverNotices.setState({ speaking: true, readingId: id });
  Speech.speak(text, {
    language: i18n.language?.startsWith('en') ? 'en-US' : 'pt-BR',
    onDone: done,
    onStopped: done,
    onError: done,
  });
}

export function stopReadingLocal(): void {
  if (!useDriverNotices.getState().readingId) return;
  loadSpeech()?.stop();
  useDriverNotices.setState({ speaking: false, readingId: null });
}

/** Só para testes. */
export function resetDriverNoticesForTests(): void {
  queue.length = 0;
  seen.clear();
  busy = false;
  useDriverNotices.setState({ speaking: false, readingId: null });
}
