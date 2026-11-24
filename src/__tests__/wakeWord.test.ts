import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/config', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/config')>();
  // Os testes cobrem também o caminho do reconhecimento no aparelho.
  return { ...mod, WAKE_WORD: { ...mod.WAKE_WORD, preferOnDevice: true } };
});
vi.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) },
}));
vi.mock('react-native-reanimated', () => ({
  default: { View: () => null },
  cancelAnimation: vi.fn(),
  Easing: { inOut: (v: unknown) => v, linear: 'linear', sin: 'sin' },
  useAnimatedStyle: () => ({}),
  useSharedValue: (value: number) => ({ value }),
  withRepeat: (a: unknown) => a,
  withSequence: (...a: unknown[]) => a[0],
  withSpring: (v: number) => v,
  withTiming: (v: number) => v,
}));
vi.mock('react-native-svg', () => ({
  default: () => null,
  Path: () => null,
  Circle: () => null,
  Line: () => null,
  Polyline: () => null,
  Rect: () => null,
}));

import { useSession, type Session } from '../features/auth';
import { useAvisaiDock, useVoice, type WakeWordEngine } from '../features/voice';
import { matchWakePhrase } from '../features/voice/rules/wakePhrase';
import type { WakeEngineHandlers } from '../features/voice/api/wakeWordEngine';
import i18n from '../lib/i18n';
import { WAKE_WORD } from '../lib/config';
import { setSetting } from '../lib/db';
import { startWakeWordWatcher, useWakeWord } from '../services/wakeWord';

describe('matchWakePhrase', () => {
  it.each(['Ei AvisAI', 'ei avisa aí', 'Hey Avis AI', 'avisaí', 'AvisAI, abre o mapa', 'oi avisa i'])(
    'acorda com "%s"',
    (fala) => expect(matchWakePhrase(fala)).toBe(true),
  );
  it.each(['me avisa aí quando chegar', 'vou avisar ele', 'e aí, tudo bem?', 'aviso importante', ''])(
    'não acorda com "%s"',
    (fala) => expect(matchWakePhrase(fala)).toBe(false),
  );
});

function fakeEngine(opts: { onDevice?: boolean; permission?: boolean } = {}) {
  let handlers: WakeEngineHandlers | null = null;
  const engine = {
    available: () => true,
    canRunOnDevice: vi.fn(async () => opts.onDevice ?? false),
    requestPermission: vi.fn(async () => opts.permission ?? true),
    start: vi.fn(),
    abort: vi.fn(),
    attach: (h: WakeEngineHandlers) => {
      handlers = h;
      return () => undefined;
    },
  } satisfies WakeWordEngine;
  return { engine, emit: () => handlers! };
}

const SESSION = { name: 'Marina Souza', email: 'marina@rotasul.test' } as unknown as Session;

describe('startWakeWordWatcher', () => {
  let stop: (() => void) | null = null;
  const listen = vi.fn();

  beforeEach(async () => {
    vi.useFakeTimers();
    await i18n.changeLanguage('pt-BR');
    listen.mockReset();
    useVoice.setState({ state: 'idle', sessionConnected: false, agoraStage: 'disconnected', listen });
    useAvisaiDock.setState({ panelOpen: false });
    setSetting('wake_word', 'on');
    useWakeWord.setState({ enabled: true, status: 'off' });
    useSession.setState({ session: SESSION });
  });

  afterEach(() => {
    stop?.();
    stop = null;
    vi.useRealTimers();
  });

  const settle = async (ms: number = WAKE_WORD.restartDelayMs) => {
    await vi.advanceTimersByTimeAsync(ms + 1);
  };

  it('só escuta com login, e acorda a conversa ao ouvir "Ei AvisAI"', async () => {
    useSession.setState({ session: null });
    const { engine, emit } = fakeEngine();
    stop = startWakeWordWatcher(engine);
    await settle();
    expect(engine.start).not.toHaveBeenCalled();

    useSession.setState({ session: SESSION });
    await settle();
    expect(engine.start).toHaveBeenCalledWith('pt-BR', false);
    expect(useWakeWord.getState().status).toBe('listening');

    emit().onTexts(['vou avisar ele'], false);
    expect(engine.abort).not.toHaveBeenCalled();

    emit().onTexts(['ei avisa aí'], false);
    expect(engine.abort).toHaveBeenCalled();
    await settle(WAKE_WORD.handoffMs);
    expect(useAvisaiDock.getState().panelOpen).toBe(true);
    expect(listen).toHaveBeenCalledTimes(1);
  });

  it('para durante a conversa e volta a escutar quando ela termina', async () => {
    const { engine } = fakeEngine();
    stop = startWakeWordWatcher(engine);
    await settle();
    expect(engine.start).toHaveBeenCalledTimes(1);

    useVoice.setState({ sessionConnected: true, agoraStage: 'live', state: 'listening' });
    expect(engine.abort).toHaveBeenCalled();
    expect(useWakeWord.getState().status).toBe('paused');

    useVoice.setState({ sessionConnected: false, agoraStage: 'disconnected', state: 'idle' });
    await settle();
    expect(engine.start).toHaveBeenCalledTimes(2);
  });

  it('desligada nas configurações não escuta', async () => {
    const { engine } = fakeEngine();
    stop = startWakeWordWatcher(engine);
    await settle();
    useWakeWord.getState().setEnabled(false);
    expect(useWakeWord.getState().status).toBe('off');
    expect(engine.abort).toHaveBeenCalled();

    // A escolha fica salva para a próxima abertura do app.
    stop();
    stop = startWakeWordWatcher(engine);
    await settle();
    expect(engine.start).toHaveBeenCalledTimes(1);
  });

  it('sem permissão de microfone fica como negada', async () => {
    const { engine } = fakeEngine({ permission: false });
    stop = startWakeWordWatcher(engine);
    await settle();
    expect(engine.start).not.toHaveBeenCalled();
    expect(useWakeWord.getState().status).toBe('denied');
  });

  it('sem o idioma no aparelho, cai para o reconhecedor padrão', async () => {
    const { engine, emit } = fakeEngine({ onDevice: true });
    stop = startWakeWordWatcher(engine);
    await settle();
    expect(engine.start).toHaveBeenLastCalledWith('pt-BR', true);
    emit().onError('language-not-supported');
    await settle();
    expect(engine.start).toHaveBeenLastCalledWith('pt-BR', false);
  });

  it('no aparelho, se a fala volta sem texto, troca para o reconhecedor padrão', async () => {
    const { engine, emit } = fakeEngine({ onDevice: true });
    stop = startWakeWordWatcher(engine);
    await settle();
    expect(engine.start).toHaveBeenLastCalledWith('pt-BR', true);
    emit().onTexts([''], true);
    expect(engine.abort).not.toHaveBeenCalled();
    emit().onTexts([''], true);
    expect(engine.abort).toHaveBeenCalled();
    await settle();
    expect(engine.start).toHaveBeenLastCalledWith('pt-BR', false);
  });

  it('reabre a escuta quando o reconhecedor encerra sozinho', async () => {
    const { engine, emit } = fakeEngine();
    stop = startWakeWordWatcher(engine);
    await settle();
    emit().onEnd();
    await settle();
    expect(engine.start).toHaveBeenCalledTimes(2);
  });
});
