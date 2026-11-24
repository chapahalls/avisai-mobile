/**
 * Reconhecedor de fala do aparelho (Android SpeechRecognizer via `expo-speech-recognition`),
 * usado só para ouvir a wake word. Sem o módulo nativo (Expo Go, testes), fica indisponível.
 */
export type WakeEngineError =
  | 'not-allowed'
  | 'language-not-supported'
  | 'service-not-allowed'
  | 'no-speech'
  | 'aborted'
  | 'busy'
  | 'other';

export interface WakeEngineHandlers {
  onTexts: (texts: string[]) => void;
  onEnd: () => void;
  onError: (error: WakeEngineError) => void;
}

export interface WakeWordEngine {
  available(): boolean;
  supportsOnDevice(): boolean;
  requestPermission(): Promise<boolean>;
  start(lang: string, onDevice: boolean): void;
  abort(): void;
  /** Liga os eventos; devolve o "desligar". */
  attach(handlers: WakeEngineHandlers): () => void;
}

type SpeechModule = typeof import('expo-speech-recognition');

function loadModule(): SpeechModule | null {
  if (process.env.VITEST) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-speech-recognition') as SpeechModule;
  } catch {
    return null; // build sem o módulo nativo
  }
}

const KNOWN_ERRORS: WakeEngineError[] = [
  'not-allowed',
  'language-not-supported',
  'service-not-allowed',
  'no-speech',
  'aborted',
  'busy',
];

export function createWakeWordEngine(): WakeWordEngine {
  const mod = loadModule();
  const native = mod?.ExpoSpeechRecognitionModule;

  return {
    available() {
      try {
        return Boolean(native?.isRecognitionAvailable());
      } catch {
        return false;
      }
    },
    supportsOnDevice() {
      try {
        return Boolean(native?.supportsOnDeviceRecognition());
      } catch {
        return false;
      }
    },
    async requestPermission() {
      if (!native) return false;
      try {
        const res = await native.requestPermissionsAsync();
        return res.granted;
      } catch {
        return false;
      }
    },
    start(lang, onDevice) {
      native?.start({
        lang,
        interimResults: true,
        continuous: true,
        maxAlternatives: 3,
        requiresOnDeviceRecognition: onDevice,
        addsPunctuation: false,
      });
    },
    abort() {
      try {
        native?.abort();
      } catch {
        // já parado
      }
    },
    attach(handlers) {
      if (!mod) return () => undefined;
      const subs = [
        mod.addSpeechRecognitionListener('result', (ev) => {
          handlers.onTexts(ev.results.map((r) => r.transcript));
        }),
        mod.addSpeechRecognitionListener('end', () => handlers.onEnd()),
        mod.addSpeechRecognitionListener('error', (ev) => {
          const code = KNOWN_ERRORS.includes(ev.error as WakeEngineError)
            ? (ev.error as WakeEngineError)
            : 'other';
          handlers.onError(code);
        }),
      ];
      return () => subs.forEach((s) => s.remove());
    },
  };
}
