import type { ExpoConfig } from 'expo/config';

/** Regras de negócio configuráveis. Na versão real vêm do cadastro da transportadora. */
export const BUSINESS = {
  /** Franquia legal antes da estadia (Lei 11.442/2007, art. 11). Configurável por contrato. */
  franchiseHours: 5,
  /** Valor ANTT por tonelada/hora desde abr/2026. Nunca fixar no código real: vem da configuração. */
  stayRatePerTonHour: 2.5,
  /** Capacidade total do veículo usada no cálculo da estadia (carga_t=28 do seed). */
  truckCapacityTons: 28,
  /** Tentativas de notificação ao CCO antes de o agente ligar para o recebedor. */
  maxCcoAttempts: 3,
  /** Intervalo entre tentativas ao CCO, em minutos simulados. */
  ccoAttemptIntervalMin: 20,
  /** Distância (km) que dispara o aviso de aproximação ao CCO e ao recebedor. */
  approachKm: 8,
  /** Raio (m) da geocerca de origem e destino (raio_chegada_m=300 do seed). */
  geofenceMeters: 300,
} as const;

export type BusinessConfig = {
  franchiseHours: number;
  stayRatePerTonHour: number;
  truckCapacityTons: number;
  maxCcoAttempts: number;
  ccoAttemptIntervalMin: number;
  approachKm: number;
  geofenceMeters: number;
};

/** Relógio simulado: 1 s real = TIME_SCALE s simulados (60 = 1 s vira 1 min). */
export const TIME_SCALE = 60;

/** Política de privacidade de voz: apenas transcrição, zero gravação de áudio bruto. */
export const VOICE_PRIVACY = {
  recordAudio: false,
  transcriptionOnly: true,
} as const;

export type ApiMode = 'mock' | 'http';
export type VoiceMode = 'mock' | 'agora';

function readHasGoogleMapsKey(): boolean {
  if (process.env.GOOGLE_MAPS_API_KEY_ANDROID?.trim()) return true;
  if (process.env.VITEST) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-constants') as {
      default?: { expoConfig?: ExpoConfig | null };
      expoConfig?: ExpoConfig | null;
    };
    const Constants = mod?.default ?? mod;
    return Boolean(Constants?.expoConfig?.extra?.hasGoogleMapsKey);
  } catch {
    return false;
  }
}

const rawApiMode = process.env.EXPO_PUBLIC_API_MODE?.trim().toLowerCase();
const rawVoiceMode = process.env.EXPO_PUBLIC_VOICE_MODE?.trim().toLowerCase();
const parsedRotaId = Number(process.env.EXPO_PUBLIC_ROTA_ID || 1);

export const ENV = {
  apiMode: (rawApiMode === 'http' ? 'http' : 'mock') as ApiMode,
  apiBaseUrl: (process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8000').replace(/\/+$/, ''),
  rotaId: Number.isFinite(parsedRotaId) && parsedRotaId > 0 ? parsedRotaId : 1,
  voiceMode: (rawVoiceMode === 'agora' ? 'agora' : 'mock') as VoiceMode,
  hasGoogleMapsKey: readHasGoogleMapsKey(),
} as const;
