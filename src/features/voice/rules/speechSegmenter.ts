/**
 * Separa as falas do motorista no áudio do microfone só pelo volume (sem modelo de voz).
 *
 * - O limiar acompanha o ruído da cabine: fala = ruído × `noiseFactor`, nunca abaixo de
 *   `minThreshold`. Os primeiros `calibrationMs` de cada escuta só medem o ruído. Depois o nível
 *   desce rápido quando a cabine fica mais quieta e sobe devagar quando fica mais barulhenta
 *   (motor, chuva): um ruído novo e constante sai do limiar sozinho, uma frase não.
 * - A fala começa depois de `startFrames` quadros seguidos acima do limiar e leva junto
 *   `preRollMs` de áudio anterior, para não cortar a primeira sílaba.
 * - Termina depois de `silenceMs` abaixo do limiar (com folga de 30%, para não cortar em pausas
 *   curtas). Falas com menos de `minSpeechMs` de voz são descartadas (tosse, batida, buzina).
 * - Uma fala maior que `maxClipMs` é entregue em partes.
 */
export interface SegmenterOptions {
  sampleRate: number;
  frameMs: number;
  startFrames: number;
  minThreshold: number;
  noiseFactor: number;
  silenceMs: number;
  minSpeechMs: number;
  maxClipMs: number;
  preRollMs: number;
  calibrationMs: number;
}

/** Fala pronta: PCM 16 bits mono. */
export interface SpeechClip {
  pcm: Uint8Array;
  durationMs: number;
}

export function frameRms(frame: Uint8Array): number {
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const samples = Math.floor(frame.byteLength / 2);
  if (!samples) return 0;
  let sum = 0;
  for (let i = 0; i < samples; i += 1) {
    const v = view.getInt16(i * 2, true);
    sum += v * v;
  }
  return Math.sqrt(sum / samples);
}

export class SpeechSegmenter {
  private readonly frameBytes: number;
  private pending = new Uint8Array(0);
  private noise = 0;
  private preRoll: Uint8Array[] = [];
  private readonly preRollFrames: number;
  private loudRun: Uint8Array[] = [];
  private speaking = false;
  private clip: Uint8Array[] = [];
  private clipFrames = 0;
  private voicedFrames = 0;
  private silentFrames = 0;
  private calibration: number[] = [];
  private readonly calibrationFrames: number;

  constructor(private readonly o: SegmenterOptions) {
    this.frameBytes = Math.round((o.sampleRate * o.frameMs) / 1000) * 2;
    this.preRollFrames = Math.ceil(o.preRollMs / o.frameMs);
    this.calibrationFrames = Math.ceil(o.calibrationMs / o.frameMs);
  }

  get isSpeaking(): boolean {
    return this.speaking;
  }

  threshold(): number {
    return Math.max(this.o.minThreshold, this.noise * this.o.noiseFactor);
  }

  /** Recebe PCM na ordem em que chegou; devolve as falas que terminaram neste pedaço. */
  push(pcm: Uint8Array): SpeechClip[] {
    const data = new Uint8Array(this.pending.length + pcm.length);
    data.set(this.pending, 0);
    data.set(pcm, this.pending.length);
    const done: SpeechClip[] = [];
    let offset = 0;
    for (; offset + this.frameBytes <= data.length; offset += this.frameBytes) {
      const clip = this.frame(data.slice(offset, offset + this.frameBytes));
      if (clip) done.push(clip);
    }
    this.pending = data.slice(offset);
    return done;
  }

  /** Fim da escuta: entrega a fala em andamento, se tiver voz suficiente. */
  flush(): SpeechClip | null {
    const clip = this.speaking ? this.finish() : null;
    this.reset();
    return clip;
  }

  reset(): void {
    this.pending = new Uint8Array(0);
    this.preRoll = [];
    this.loudRun = [];
    this.speaking = false;
    this.clip = [];
    this.clipFrames = 0;
    this.voicedFrames = 0;
    this.silentFrames = 0;
    this.calibration = [];
    this.noise = 0;
  }

  private frame(frame: Uint8Array): SpeechClip | null {
    const rms = frameRms(frame);

    if (this.calibration.length < this.calibrationFrames) {
      // Ruído da cabine: média da metade mais quieta (ignora uma batida no meio).
      this.calibration.push(rms);
      if (this.calibration.length === this.calibrationFrames) {
        const quiet = [...this.calibration].sort((a, b) => a - b).slice(0, Math.ceil(this.calibrationFrames / 2));
        this.noise = quiet.reduce((a, b) => a + b, 0) / quiet.length;
      }
      this.pushPreRoll(frame);
      return null;
    }

    const limit = this.threshold();
    this.noise = rms < this.noise ? this.noise * 0.9 + rms * 0.1 : this.noise * 0.999 + rms * 0.001;

    if (!this.speaking) {
      if (rms >= limit) {
        this.loudRun.push(frame);
        if (this.loudRun.length >= this.o.startFrames) {
          this.speaking = true;
          this.clip = [...this.preRoll, ...this.loudRun];
          this.clipFrames = this.clip.length;
          this.voicedFrames = this.loudRun.length;
          this.silentFrames = 0;
          this.preRoll = [];
          this.loudRun = [];
        }
        return null;
      }
      this.loudRun.forEach((f) => this.pushPreRoll(f));
      this.loudRun = [];
      this.pushPreRoll(frame);
      return null;
    }

    this.clip.push(frame);
    this.clipFrames += 1;
    if (rms >= limit * 0.7) {
      this.voicedFrames += 1;
      this.silentFrames = 0;
    } else {
      this.silentFrames += 1;
    }

    if (this.silentFrames * this.o.frameMs >= this.o.silenceMs) {
      const clip = this.finish();
      this.speaking = false;
      this.clip = [];
      return clip;
    }
    if (this.clipFrames * this.o.frameMs >= this.o.maxClipMs) {
      // Fala longa: entrega esta parte e continua gravando a próxima.
      const clip = this.finish();
      this.clip = [];
      this.clipFrames = 0;
      this.voicedFrames = 0;
      this.silentFrames = 0;
      return clip;
    }
    return null;
  }

  private pushPreRoll(frame: Uint8Array): void {
    this.preRoll.push(frame);
    if (this.preRoll.length > this.preRollFrames) {
      this.preRoll.splice(0, this.preRoll.length - this.preRollFrames);
    }
  }

  private finish(): SpeechClip | null {
    const voicedMs = this.voicedFrames * this.o.frameMs;
    if (voicedMs < this.o.minSpeechMs || !this.clip.length) return null;
    // Corta o silêncio do fim, deixando 200 ms de respiro.
    const keepSilence = Math.round(200 / this.o.frameMs);
    const drop = Math.max(0, this.silentFrames - keepSilence);
    const frames = drop ? this.clip.slice(0, this.clip.length - drop) : this.clip;
    const pcm = new Uint8Array(frames.length * this.frameBytes);
    frames.forEach((f, i) => pcm.set(f, i * this.frameBytes));
    return { pcm, durationMs: frames.length * this.o.frameMs };
  }
}
