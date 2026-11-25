import { getOfflineWhisperModelPaths } from './offlineWhisperModel';

type OfflineWhisperCallbacks = {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
};

type WhisperContext = Awaited<ReturnType<typeof import('whisper.rn').initWhisper>>;
type WhisperVadContext = Awaited<ReturnType<typeof import('whisper.rn').initWhisperVad>>;
type RealtimeTranscriber = InstanceType<
  typeof import('whisper.rn/lib/typescript/realtime-transcription').RealtimeTranscriber
>;
type PcmAdapter = InstanceType<
  typeof import('whisper.rn/lib/typescript/realtime-transcription/adapters/AudioPcmStreamAdapter').AudioPcmStreamAdapter
>;

// Subcaminhos com o arquivo real: o TypeScript (moduleResolution "node") e o Metro do SDK 52
// ignoram o campo `exports` do whisper.rn. Tipos vêm de lib/typescript; o código, de src/
// (o mesmo que o pacote indica para React Native).
interface WhisperApi {
  initWhisper: typeof import('whisper.rn').initWhisper;
  initWhisperVad: typeof import('whisper.rn').initWhisperVad;
}

interface RealtimeApi {
  RealtimeTranscriber: typeof import('whisper.rn/lib/typescript/realtime-transcription').RealtimeTranscriber;
  RingBufferVad: typeof import('whisper.rn/lib/typescript/realtime-transcription').RingBufferVad;
}

interface PcmApi {
  AudioPcmStreamAdapter: typeof import('whisper.rn/lib/typescript/realtime-transcription/adapters/AudioPcmStreamAdapter').AudioPcmStreamAdapter;
}

/**
 * Só o microfone: o Whisper roda no aparelho e não usa o reconhecedor do Google.
 * Os métodos ficam em `ExpoSpeechRecognitionModule` (não no topo do pacote, que na 1.x
 * não exporta `requestPermissionsAsync` e fazia toda chamada cair em "negada").
 */
async function requestMicPermission(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition') as {
      ExpoSpeechRecognitionModule: {
        requestMicrophonePermissionsAsync: () => Promise<{ granted: boolean }>;
      };
    };
    const permission = await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
    return permission.granted;
  } catch (error) {
    console.warn('[whisper-offline] falha ao pedir o microfone:', error instanceof Error ? error.message : error);
    return false;
  }
}

/** Reconhecimento local contínuo. O áudio é processado no aparelho e não é gravado em arquivo. */
export class OfflineWhisperSession {
  private whisperContext: WhisperContext | null = null;
  private vadContext: WhisperVadContext | null = null;
  private transcriber: RealtimeTranscriber | null = null;
  private stream: PcmAdapter | null = null;
  private stopPromise: Promise<void> | null = null;
  private callbacks: OfflineWhisperCallbacks;

  constructor(callbacks: OfflineWhisperCallbacks) {
    this.callbacks = callbacks;
  }

  private async loadModels() {
    if (this.whisperContext && this.vadContext) return;
    if (process.env.VITEST) throw new Error('Whisper local está indisponível nos testes.');
    const { modelPath, vadPath } = getOfflineWhisperModelPaths();
    // Native modules are loaded only when the offline recognizer is actually needed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const whisper = require('whisper.rn') as WhisperApi;
    const whisperContext = await whisper.initWhisper({ filePath: modelPath, useGpu: false });
    try {
      const vadContext = await whisper.initWhisperVad({ filePath: vadPath, useGpu: false, nThreads: 2 });
      this.whisperContext = whisperContext;
      this.vadContext = vadContext;
    } catch (error) {
      await whisperContext.release();
      throw error;
    }
  }

  async startListening() {
    if (this.transcriber) return;
    if (this.stopPromise) await this.stopPromise;
    const granted = await requestMicPermission();
    if (!granted) throw new Error('Permissão de microfone negada.');
    await this.loadModels();
    if (!this.whisperContext || !this.vadContext) throw new Error('Não consegui carregar o Whisper local.');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const realtime = require('whisper.rn/src/realtime-transcription') as RealtimeApi;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pcm = require('whisper.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter') as PcmApi;
    this.stream = new pcm.AudioPcmStreamAdapter();
    const vad = new realtime.RingBufferVad(this.vadContext, {
      vadPreset: 'default',
      preRecordingBufferMs: 1000,
      inferenceIntervalMs: 500,
      sampleRate: 16000,
    });
    const transcriber = new realtime.RealtimeTranscriber(
      { whisperContext: this.whisperContext, vadContext: vad, audioStream: this.stream },
      {
        audioSliceSec: 30,
        audioMinSec: 0.6,
        maxSlicesInMemory: 1,
        promptPreviousSlices: false,
        audioStreamConfig: {
          sampleRate: 16000,
          channels: 1,
          bitsPerSample: 16,
          audioSource: 6,
          bufferSize: 16 * 1024,
        },
        initialPrompt:
          'Vocabulário brasileiro de transporte: RODAR, AvisAI, CCO, CD, doca, carga, descarga, avaria, BR, quilômetro, retirada, check-in.',
        transcribeOptions: { language: 'pt', maxThreads: 4 },
      },
      {
        onSliceTranscriptionStabilized: (text) => {
          const clean = text.trim();
          if (!clean) return;
          this.callbacks.onTranscript(clean);
        },
        onError: (message) => this.callbacks.onError(message),
      },
    );
    this.transcriber = transcriber;
    try {
      await transcriber.start();
    } catch (error) {
      this.transcriber = null;
      await this.stream?.stop().catch(() => undefined);
      await this.stream?.release().catch(() => undefined);
      this.stream = null;
      throw error;
    }
  }

  async stopListening() {
    const transcriber = this.transcriber;
    if (!transcriber) return;
    this.transcriber = null;
    this.stopPromise = transcriber.stop().finally(() => {
      this.stream = null;
      this.stopPromise = null;
    });
    await this.stopPromise;
  }

  async stop() {
    await this.stopListening();
    await this.whisperContext?.release();
    await this.vadContext?.release();
    this.whisperContext = null;
    this.vadContext = null;
  }
}
