import { AppState } from 'react-native';
import { create } from 'zustand';
import i18n from '../lib/i18n';
import { WAKE_WORD } from '../lib/config';
import { getSetting, setSetting } from '../lib/db';
import { hapticTap } from '../utils/haptics';
import { useDriverNotices } from './driverNotices';
import { useSession } from '../features/auth';
import {
  createWakeWordEngine,
  matchWakePhrase,
  useAvisaiDock,
  useVoice,
  type WakeWordEngine,
} from '../features/voice';

/**
 * - `listening`: o aparelho está esperando "Ei AvisAI";
 * - `paused`: ligada, mas parada agora (conversa aberta, app em segundo plano, sem login);
 * - `off`: desligada pelo motorista; `denied`: sem microfone; `unavailable`: aparelho sem reconhecedor.
 */
export type WakeStatus = 'off' | 'listening' | 'paused' | 'unavailable' | 'denied';

interface WakeWordState {
  enabled: boolean;
  status: WakeStatus;
  setEnabled: (on: boolean) => void;
}

export const useWakeWord = create<WakeWordState>((set) => ({
  enabled: WAKE_WORD.enabledByDefault,
  status: 'off',
  setEnabled: (on) => {
    setSetting('wake_word', on ? 'on' : 'off');
    set({ enabled: on });
  },
}));

/**
 * Escuta "Ei AvisAI" com o app aberto e sem conversa ativa. Ao ouvir, libera o microfone,
 * abre o painel do AvisAI e inicia a conversa (no LiveKit, conecta a sessão). O texto
 * reconhecido serve só para achar a wake word e é descartado.
 */
export function startWakeWordWatcher(engine: WakeWordEngine = createWakeWordEngine()): () => void {
  const saved = getSetting('wake_word');
  if (saved === 'on' || saved === 'off') useWakeWord.setState({ enabled: saved === 'on' });

  if (!engine.available()) {
    useWakeWord.setState({ status: 'unavailable' });
    return () => undefined;
  }

  let running = false;
  let waking = false;
  let unavailable = false;
  /** `null` = ainda não sabe se o idioma atual roda no aparelho. */
  let onDevice: boolean | null = null;
  let emptyFinals = 0;
  let permission: 'unknown' | 'granted' | 'denied' = 'unknown';
  let appActive = AppState.currentState === 'active';
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let wakeTimer: ReturnType<typeof setTimeout> | null = null;

  const voiceIdle = () => {
    const v = useVoice.getState();
    return (
      !v.sessionConnected &&
      !v.offlineRecordingActive &&
      v.state === 'idle' &&
      v.liveKitStage !== 'connecting' &&
      v.liveKitStage !== 'waiting_agent'
    );
  };

  const shouldListen = () =>
    useWakeWord.getState().enabled &&
    !unavailable &&
    permission !== 'denied' &&
    appActive &&
    !waking &&
    !useDriverNotices.getState().speaking && // não se ouvir lendo um aviso
    Boolean(useSession.getState().session) &&
    voiceIdle();

  const setStatus = (status: WakeStatus) => {
    if (useWakeWord.getState().status !== status) useWakeWord.setState({ status });
  };

  const idleStatus = (): WakeStatus =>
    unavailable
      ? 'unavailable'
      : !useWakeWord.getState().enabled
        ? 'off'
        : permission === 'denied'
          ? 'denied'
          : 'paused';

  const clearRestart = () => {
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = null;
  };

  const schedule = (delay: number) => {
    clearRestart();
    restartTimer = setTimeout(() => void startNow(), delay);
  };

  const stopNow = () => {
    clearRestart();
    if (running) {
      running = false;
      engine.abort();
    }
  };

  async function startNow() {
    restartTimer = null;
    if (running || !shouldListen()) return;
    if (permission === 'unknown') {
      permission = (await engine.requestPermission()) ? 'granted' : 'denied';
      if (permission === 'denied') {
        setStatus('denied');
        return;
      }
      if (running || !shouldListen()) return;
    }
    const lang = i18n.language?.startsWith('en') ? 'en-US' : 'pt-BR';
    if (onDevice === null) {
      onDevice = WAKE_WORD.preferOnDevice && (await engine.canRunOnDevice(lang));
      if (running || !shouldListen()) return;
    }
    running = true;
    setStatus('listening');
    try {
      engine.start(lang, onDevice);
    } catch {
      running = false;
      schedule(WAKE_WORD.errorBackoffMs);
    }
  }

  const sync = () => {
    if (shouldListen()) {
      if (!running && !restartTimer) schedule(WAKE_WORD.restartDelayMs);
      return;
    }
    stopNow();
    setStatus(idleStatus());
  };

  const wake = () => {
    waking = true;
    stopNow();
    setStatus('paused');
    hapticTap();
    // Dá tempo de o reconhecedor soltar o microfone antes de o LiveKit abrir o dele.
    wakeTimer = setTimeout(() => {
      wakeTimer = null;
      waking = false;
      const voice = useVoice.getState();
      // Voz real (LiveKit): só liga o microfone, sem Painel com frases prontas por cima da tela.
      if (!voice.isDirectVoice()) useAvisaiDock.getState().openPanel();
      voice.listen();
      sync();
    }, WAKE_WORD.handoffMs);
  };

  const detach = engine.attach({
    onTexts: (texts, isFinal) => {
      if (!running || waking) return;
      if (texts.some(matchWakePhrase)) {
        emptyFinals = 0;
        wake();
        return;
      }
      if (!isFinal) return;
      // Fala ouvida, texto vazio: o modelo do aparelho não entende o idioma. Usa o reconhecedor padrão.
      emptyFinals = texts.every((t) => !t.trim()) ? emptyFinals + 1 : 0;
      if (onDevice && emptyFinals >= WAKE_WORD.emptyResultsBeforeFallback) {
        onDevice = false;
        emptyFinals = 0;
        stopNow();
        schedule(WAKE_WORD.restartDelayMs);
      }
    },
    onEnd: () => {
      if (!running) return;
      running = false;
      if (shouldListen()) schedule(WAKE_WORD.restartDelayMs);
      else sync();
    },
    onError: (error) => {
      if (!running) return;
      running = false;
      if (error === 'not-allowed') {
        permission = 'denied';
        setStatus('denied');
        return;
      }
      if (error === 'language-not-supported' || error === 'service-not-allowed') {
        if (onDevice) {
          onDevice = false; // sem o pacote de idioma no aparelho: usa o reconhecedor padrão
          schedule(WAKE_WORD.restartDelayMs);
        } else {
          unavailable = true;
          setStatus('unavailable');
        }
        return;
      }
      const benign = error === 'no-speech' || error === 'aborted';
      schedule(benign ? WAKE_WORD.restartDelayMs : WAKE_WORD.errorBackoffMs);
    },
  });

  const offVoice = useVoice.subscribe(sync);
  const offSession = useSession.subscribe(sync);
  const offNotices = useDriverNotices.subscribe(sync);
  const offWake = useWakeWord.subscribe((s, prev) => {
    if (s.enabled === prev.enabled) return;
    if (s.enabled && permission === 'denied') permission = 'unknown'; // religou: pede de novo
    sync();
  });
  const appSub = AppState.addEventListener('change', (state) => {
    appActive = state === 'active';
    sync();
  });
  const onLanguage = () => {
    onDevice = null;
    emptyFinals = 0;
    stopNow();
    sync();
  };
  i18n.on('languageChanged', onLanguage);

  sync();

  return () => {
    stopNow();
    if (wakeTimer) clearTimeout(wakeTimer);
    detach();
    offVoice();
    offSession();
    offNotices();
    offWake();
    appSub.remove();
    i18n.off('languageChanged', onLanguage);
  };
}
