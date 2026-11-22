import type { VoiceState } from '../types';

export type AgoraStreamEvent =
  | {
      kind: 'transcript';
      who: 'driver' | 'agent';
      text: string;
      isFinal: boolean;
      interrupted?: boolean;
      turnId?: string;
      latencyMs?: number;
    }
  | { kind: 'state'; state: VoiceState }
  | { kind: 'interrupt'; turnId?: string }
  | { kind: 'metrics'; latencyMs: number };

interface ChunkBufferEntry {
  totalParts: number;
  chunks: Map<number, string>;
  createdAt: number;
}

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const STALE_BUFFER_TTL_MS = 15_000;
const MAX_BUFFER_ENTRIES = 32;

export function decodeUtf8(input: Uint8Array | string): string {
  if (typeof input === 'string') return input;
  try {
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8').decode(input);
    }
  } catch {
    // Fallback manual UTF-8
  }

  let out = '';
  let i = 0;
  while (i < input.length) {
    const b0 = input[i++];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
    } else if ((b0 & 0xe0) === 0xc0 && i < input.length) {
      const b1 = input[i++] & 0x3f;
      out += String.fromCharCode(((b0 & 0x1f) << 6) | b1);
    } else if ((b0 & 0xf0) === 0xe0 && i + 1 < input.length) {
      const b1 = input[i++] & 0x3f;
      const b2 = input[i++] & 0x3f;
      out += String.fromCharCode(((b0 & 0x0f) << 12) | (b1 << 6) | b2);
    } else if ((b0 & 0xf8) === 0xf0 && i + 2 < input.length) {
      const b1 = input[i++] & 0x3f;
      const b2 = input[i++] & 0x3f;
      const b3 = input[i++] & 0x3f;
      const cp = (((b0 & 0x07) << 18) | (b1 << 12) | (b2 << 6) | b3) - 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      out += String.fromCharCode(b0);
    }
  }
  return out;
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[\r\n\s]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (typeof atob === 'function') {
    try {
      const padded =
        clean.length % 4 === 0 ? clean : clean + '='.repeat((4 - (clean.length % 4)) % 4);
      const bin = atob(padded);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i) & 0xff;
      }
      return bytes;
    } catch {
      // Fallback para decodificador puro JS abaixo
    }
  }

  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '=') break;
    const val = B64_CHARS.indexOf(ch);
    if (val === -1) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

export function decodeBase64Utf8(b64: string): string {
  return decodeUtf8(decodeBase64ToBytes(b64));
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((acc, a) => acc + a.length, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) {
    merged.set(a, offset);
    offset += a.length;
  }
  return merged;
}

function mapVoiceState(rawState: unknown): VoiceState | null {
  const s = typeof rawState === 'string' ? rawState.trim().toLowerCase() : '';
  switch (s) {
    case 'speaking':
      return 'speaking';
    case 'thinking':
      return 'thinking';
    case 'listening':
      return 'listening';
    case 'idle':
    case 'silent':
      return 'idle';
    case 'interrupted':
      return 'interrupted';
    default:
      return null;
  }
}

/**
 * Parser do datastream da Agora Conversational AI Engine.
 * Suporta:
 * 1. Formato oficial em chunks `<message_id>|<part_index>|<total_parts>|<base64_payload>`
 *    (com remontagem ordenada e limpeza de buffers órfãos).
 * 2. JSON plano direto (`user.transcription`, `assistant.transcription`, `message.state`,
 *    `message.interrupt`, `message.metrics` e formato flat legado).
 */
export class AgoraStreamParser {
  private readonly buffers = new Map<string, ChunkBufferEntry>();

  reset(): void {
    this.buffers.clear();
  }

  private pruneBuffers(now: number): void {
    for (const [id, entry] of this.buffers.entries()) {
      if (now - entry.createdAt > STALE_BUFFER_TTL_MS) {
        this.buffers.delete(id);
      }
    }
    while (this.buffers.size > MAX_BUFFER_ENTRIES) {
      const oldestKey = this.buffers.keys().next().value;
      if (oldestKey === undefined) break;
      this.buffers.delete(oldestKey);
    }
  }

  private resolvePayloadJson(raw: string): Record<string, unknown> | null {
    const trimmed = raw.replace(/\0+$/g, '').trim();
    if (!trimmed) return null;

    if (!trimmed.startsWith('{') && trimmed.includes('|')) {
      const parts = trimmed.split('|');
      if (parts.length === 4) {
        const [msgId, partIdxStr, totalPartsStr, b64Chunk] = parts;
        const partIndex = Number(partIdxStr);
        const totalParts = Number(totalPartsStr);

        if (
          msgId &&
          Number.isInteger(partIndex) &&
          Number.isInteger(totalParts) &&
          partIndex >= 1 &&
          totalParts >= 1 &&
          partIndex <= totalParts
        ) {
          if (totalParts === 1) {
            this.buffers.delete(msgId);
            const decoded = decodeBase64Utf8(b64Chunk);
            return JSON.parse(decoded) as Record<string, unknown>;
          }

          const now = Date.now();
          this.pruneBuffers(now);

          let entry = this.buffers.get(msgId);
          if (!entry || entry.totalParts !== totalParts) {
            entry = {
              totalParts,
              chunks: new Map<number, string>(),
              createdAt: now,
            };
            this.buffers.set(msgId, entry);
          }

          entry.chunks.set(partIndex, b64Chunk);

          if (entry.chunks.size < totalParts) {
            return null;
          }

          const orderedB64: string[] = [];
          for (let i = 1; i <= totalParts; i++) {
            const c = entry.chunks.get(i);
            if (c === undefined) return null;
            orderedB64.push(c);
          }
          this.buffers.delete(msgId);

          // Caso 1: base64 inteiro fatiado em múltiplos pacotes
          try {
            const joinedDecoded = decodeBase64Utf8(orderedB64.join(''));
            return JSON.parse(joinedDecoded) as Record<string, unknown>;
          } catch {
            // Caso 2: cada pacote codificado em base64 individualmente
            const mergedBytes = concatUint8Arrays(orderedB64.map(decodeBase64ToBytes));
            const mergedDecoded = decodeUtf8(mergedBytes);
            return JSON.parse(mergedDecoded) as Record<string, unknown>;
          }
        }
      }
    }

    return JSON.parse(trimmed) as Record<string, unknown>;
  }

  parse(input: Uint8Array | string): AgoraStreamEvent | null {
    try {
      const raw = decodeUtf8(input);
      const msg = this.resolvePayloadJson(raw);
      if (!msg || typeof msg !== 'object') return null;

      const objType = typeof msg.object === 'string' ? msg.object.trim().toLowerCase() : '';
      const turnId =
        msg.turn_id !== undefined && msg.turn_id !== null
          ? String(msg.turn_id)
          : msg.turnId !== undefined && msg.turnId !== null
            ? String(msg.turnId)
            : undefined;

      if (objType === 'user.transcription') {
        const text = (
          typeof msg.text === 'string'
            ? msg.text
            : typeof msg.transcript === 'string'
              ? msg.transcript
              : ''
        ).trim();
        if (!text) return null;
        const isFinal = Boolean(msg.final ?? msg.is_final ?? true);
        return {
          kind: 'transcript',
          who: 'driver',
          text,
          isFinal,
          ...(turnId ? { turnId } : {}),
        };
      }

      if (objType === 'assistant.transcription') {
        const text = (
          typeof msg.text === 'string'
            ? msg.text
            : typeof msg.transcript === 'string'
              ? msg.transcript
              : ''
        ).trim();
        if (!text) return null;
        const turnStatus = typeof msg.turn_status === 'number' ? msg.turn_status : undefined;
        const isFinal =
          turnStatus === 1 || turnStatus === 2 || Boolean(msg.final ?? msg.is_final);
        const interrupted = turnStatus === 2 || Boolean(msg.interrupted);
        const latencyMs =
          typeof msg.latency_ms === 'number' && msg.latency_ms > 0
            ? msg.latency_ms
            : typeof msg.latencyMs === 'number' && msg.latencyMs > 0
              ? msg.latencyMs
              : undefined;
        return {
          kind: 'transcript',
          who: 'agent',
          text,
          isFinal,
          interrupted,
          ...(turnId ? { turnId } : {}),
          ...(latencyMs !== undefined ? { latencyMs } : {}),
        };
      }

      if (objType === 'message.state' || objType === 'assistant.state') {
        const mapped = mapVoiceState(msg.state);
        if (!mapped) return null;
        return { kind: 'state', state: mapped };
      }

      if (objType === 'message.interrupt' || objType === 'assistant.interrupt') {
        return {
          kind: 'interrupt',
          ...(turnId ? { turnId } : {}),
        };
      }

      if (objType === 'message.metrics') {
        const rawLatency =
          typeof msg.latency_ms === 'number'
            ? msg.latency_ms
            : typeof msg.metric_value === 'number'
              ? msg.metric_value
              : typeof msg.latencyMs === 'number'
                ? msg.latencyMs
                : 0;
        if (rawLatency > 0) {
          return { kind: 'metrics', latencyMs: Math.round(rawLatency) };
        }
        return null;
      }

      // Fallback flat JSON legado (text / transcript)
      const text = (
        typeof msg.text === 'string'
          ? msg.text
          : typeof msg.transcript === 'string'
            ? msg.transcript
            : ''
      ).trim();
      if (!text) return null;

      const role = String(msg.speaker ?? msg.role ?? 'agent').toLowerCase();
      const who: 'driver' | 'agent' =
        role === 'driver' || role === 'user' || role === 'motorista' ? 'driver' : 'agent';
      const isFinal = Boolean(msg.isFinal ?? msg.final ?? true);
      const latencyMs =
        typeof msg.latencyMs === 'number' && msg.latencyMs > 0
          ? msg.latencyMs
          : typeof msg.latency_ms === 'number' && msg.latency_ms > 0
            ? msg.latency_ms
            : undefined;

      return {
        kind: 'transcript',
        who,
        text,
        isFinal,
        ...(turnId ? { turnId } : {}),
        ...(latencyMs !== undefined ? { latencyMs } : {}),
      };
    } catch {
      return null;
    }
  }
}
