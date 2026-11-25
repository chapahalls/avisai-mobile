import { describe, expect, it } from 'vitest';
import { OFFLINE_VOICE } from '../lib/config';
import { base64ToBytes, bytesToBase64 } from '../lib/base64';
import { SpeechSegmenter, frameRms } from '../features/voice/rules/speechSegmenter';
import { pcm16DurationMs, pcm16ToWav } from '../features/voice/rules/wav';

const SR = OFFLINE_VOICE.sampleRate;

/** PCM 16 bits com uma senoide (fala) ou ruído baixo (cabine). */
function tone(ms: number, amplitude: number): Uint8Array {
  const n = Math.round((SR * ms) / 1000);
  const out = new Uint8Array(n * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < n; i += 1) {
    view.setInt16(i * 2, Math.round(amplitude * Math.sin((2 * Math.PI * 220 * i) / SR)), true);
  }
  return out;
}
const silence = (ms: number) => tone(ms, 100);
const speech = (ms: number) => tone(ms, 6000);

function feed(seg: SpeechSegmenter, ...parts: Uint8Array[]) {
  const clips = [];
  for (const p of parts) {
    // O microfone entrega pedaços de ~128 ms.
    for (let i = 0; i < p.length; i += 4096) clips.push(...seg.push(p.subarray(i, i + 4096)));
  }
  return clips;
}

describe('base64', () => {
  it('ida e volta preserva os bytes em todos os tamanhos de resto', () => {
    for (const len of [0, 1, 2, 3, 4, 5, 1000]) {
      const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 37) % 256);
      expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
    }
  });
});

describe('WAV', () => {
  it('cabeçalho RIFF PCM mono 16 kHz que o backend reconhece', () => {
    const wav = pcm16ToWav(new Uint8Array(32000), SR);
    const view = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...wav.subarray(8, 12))).toBe('WAVE');
    expect(view.getUint32(24, true)).toBe(SR);
    expect(view.getUint32(40, true)).toBe(32000);
    expect(wav.length).toBe(44 + 32000);
    expect(pcm16DurationMs(32000, SR)).toBe(1000);
  });
});

describe('separação de falas pelo volume', () => {
  it('fala entre silêncios vira um áudio, sem o silêncio comprido do fim', () => {
    const seg = new SpeechSegmenter(OFFLINE_VOICE);
    const clips = feed(seg, silence(1000), speech(1500), silence(2000));
    expect(clips).toHaveLength(1);
    // pré-roll (300) + fala (1500) + no máximo 200 ms de respiro
    expect(clips[0].durationMs).toBeGreaterThanOrEqual(1500);
    expect(clips[0].durationMs).toBeLessThanOrEqual(2100);
    expect(seg.isSpeaking).toBe(false);
  });

  it('duas falas separadas por silêncio viram dois áudios', () => {
    const seg = new SpeechSegmenter(OFFLINE_VOICE);
    expect(feed(seg, silence(500), speech(1000), silence(1600), speech(800), silence(1600))).toHaveLength(2);
  });

  it('pausa curta no meio da frase não corta a fala', () => {
    const seg = new SpeechSegmenter(OFFLINE_VOICE);
    expect(feed(seg, silence(500), speech(800), silence(500), speech(800), silence(1600))).toHaveLength(1);
  });

  it('barulho curto (batida, tosse) é descartado', () => {
    const seg = new SpeechSegmenter(OFFLINE_VOICE);
    expect(feed(seg, silence(500), speech(200), silence(2000))).toHaveLength(0);
  });

  it('só ruído de cabine não vira fala', () => {
    const seg = new SpeechSegmenter(OFFLINE_VOICE);
    expect(feed(seg, silence(5000))).toHaveLength(0);
  });

  it('motor alto desde o início não vira fala e não esconde a voz', () => {
    const seg = new SpeechSegmenter(OFFLINE_VOICE);
    expect(feed(seg, tone(3000, 1500))).toHaveLength(0);
    expect(seg.threshold()).toBeGreaterThan(OFFLINE_VOICE.minThreshold);
    expect(feed(seg, speech(1200), tone(1600, 1500))).toHaveLength(1);
  });

  it('ruído que aparece depois (chuva, estrada) para de contar como fala', () => {
    const seg = new SpeechSegmenter(OFFLINE_VOICE);
    const clips = feed(seg, silence(500), tone(60000, 1500));
    // No máximo um pedaço no começo, até o limiar alcançar o ruído novo.
    expect(clips.length).toBeLessThanOrEqual(2);
    expect(seg.isSpeaking).toBe(false);
  });

  it('fala muito longa é entregue em partes', () => {
    const seg = new SpeechSegmenter({ ...OFFLINE_VOICE, maxClipMs: 2000 });
    const clips = feed(seg, silence(500), speech(5000), silence(1600));
    expect(clips.length).toBeGreaterThanOrEqual(3);
  });

  it('parar a escuta no meio da fala entrega o que já tinha', () => {
    const seg = new SpeechSegmenter(OFFLINE_VOICE);
    feed(seg, silence(500), speech(1200));
    const clip = seg.flush();
    expect(clip?.durationMs).toBeGreaterThanOrEqual(1200);
    expect(seg.flush()).toBeNull();
  });

  it('RMS de uma senoide é amplitude/√2', () => {
    expect(frameRms(tone(100, 1000))).toBeCloseTo(1000 / Math.SQRT2, -1);
  });
});
