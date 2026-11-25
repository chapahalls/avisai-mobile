import { OFFLINE_VOICE } from '../../../lib/config';
import { base64ToBytes } from '../../../lib/base64';
import { newId } from '../../../lib/id';
import { saveVoiceNote } from '../../../services/voiceNotesStore';
import { SpeechSegmenter, type SpeechClip } from '../rules/speechSegmenter';
import { pcm16ToWav } from '../rules/wav';

export interface OfflineVoiceNote {
  id: string;
  filePath: string;
  durationMs: number;
  /** Fim da fala, em ISO. */
  spokenAt: string;
}

interface Callbacks {
  onNote: (note: OfflineVoiceNote) => void;
  onError: (message: string) => void;
}

interface LiveAudioStream {
  init(options: { sampleRate: number; channels: number; bitsPerSample: number; audioSource?: number; bufferSize?: number; wavFile: string }): void;
  start(): void;
  stop(): Promise<unknown>;
  on(event: 'data', callback: (data: string) => void): { remove(): void } | void;
}

function loadStream(): LiveAudioStream | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@fugood/react-native-audio-pcm-stream') as { default?: LiveAudioStream } & LiveAudioStream;
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

async function requestMicPermission(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition') as {
      ExpoSpeechRecognitionModule: {
        requestMicrophonePermissionsAsync: () => Promise<{ granted: boolean }>;
      };
    };
    return (await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Sem rede: grava cada fala do motorista em WAV para enviar depois (offline-first). Não roda
 * modelo de voz: as falas são separadas pelo volume (`rules/speechSegmenter`). Só escuta enquanto
 * a conversa está aberta e a rede caiu; para quando o agente fala ou a conversa fecha.
 */
export class OfflineVoiceRecorder {
  private stream: LiveAudioStream | null = null;
  private subscription: { remove(): void } | void = undefined;
  private segmenter = new SpeechSegmenter(OFFLINE_VOICE);
  private listening = false;

  constructor(private readonly callbacks: Callbacks) {}

  get isListening(): boolean {
    return this.listening;
  }

  async startListening(): Promise<void> {
    if (this.listening) return;
    if (!(await requestMicPermission())) throw new Error('Permissão de microfone negada.');
    const stream = loadStream();
    if (!stream) throw new Error('Gravação de áudio indisponível neste aparelho.');
    this.stream = stream;
    this.segmenter.reset();
    stream.init({
      sampleRate: OFFLINE_VOICE.sampleRate,
      channels: 1,
      bitsPerSample: 16,
      audioSource: 6, // VOICE_RECOGNITION: sem o processamento de chamada que abafa a voz
      bufferSize: 4096,
      wavFile: '',
    });
    this.subscription = stream.on('data', (chunk) => {
      if (!this.listening) return;
      for (const clip of this.segmenter.push(base64ToBytes(chunk))) void this.save(clip);
    });
    stream.start();
    this.listening = true;
  }

  /** Para de ouvir; a fala em andamento, se tiver voz suficiente, é guardada. */
  async stopListening(): Promise<void> {
    if (!this.listening) return;
    this.listening = false;
    await this.stream?.stop().catch(() => undefined);
    this.subscription?.remove();
    this.subscription = undefined;
    const last = this.segmenter.flush();
    if (last) await this.save(last);
  }

  async stop(): Promise<void> {
    await this.stopListening();
    this.stream = null;
  }

  private async save(clip: SpeechClip): Promise<void> {
    const id = newId();
    try {
      const filePath = await saveVoiceNote(id, pcm16ToWav(clip.pcm, OFFLINE_VOICE.sampleRate));
      this.callbacks.onNote({ id, filePath, durationMs: clip.durationMs, spokenAt: new Date().toISOString() });
    } catch (error) {
      this.callbacks.onError(error instanceof Error ? error.message : String(error));
    }
  }
}
