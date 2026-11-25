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
  /** Hipóteses do reconhecedor; `isFinal` marca o fim de um trecho de fala. */
  onTexts: (texts: string[], isFinal: boolean) => void;
  onEnd: () => void;
  onError: (error: WakeEngineError) => void;
}

export interface WakeWordEngine {
  available(): boolean;
  /** O aparelho reconhece este idioma sem internet (modelo instalado)? */
  canRunOnDevice(lang: string): Promise<boolean>;
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

/** Serviço do Android que faz o reconhecimento no aparelho (Android System Intelligence). */
const ON_DEVICE_SERVICE = 'com.google.android.as';

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
    async canRunOnDevice(lang) {
      if (!mod || !native) return false;
      try {
        if (!native.supportsOnDeviceRecognition()) return false;
        // Sem o modelo do idioma, o reconhecimento no aparelho ouve a fala mas devolve texto vazio.
        const { installedLocales } = await mod.getSupportedLocales({
          androidRecognitionServicePackage: ON_DEVICE_SERVICE,
        });
        const want = lang.toLowerCase().replace('_', '-');
        return installedLocales.some((l) => l.toLowerCase().replace('_', '-') === want);
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
        // Contínuo: no Android 13+ o próprio app captura o microfone e o Android não toca o
        // bipe de início a cada frase. (Com o modelo offline do Galaxy A17 vinha vazio; com o
        // reconhecedor padrão do Google funciona.)
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
      if (!native) return () => undefined;
      // Direto no módulo nativo: o `addSpeechRecognitionListener` do pacote é o `addListener`
      // sem `this` e não entrega os eventos quando chamado como método de outro objeto.
      const subs = [
        native.addListener('result', (ev) => {
          handlers.onTexts(
            ev.results.map((r) => r.transcript),
            ev.isFinal,
          );
        }),
        native.addListener('end', () => handlers.onEnd()),
        native.addListener('error', (ev) => {
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
