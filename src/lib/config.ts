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

/**
 * Voz RTC direta: sem gravação nem legendas/transcrição consumidas pelo cliente.
 * Os comandos do app chegam do backend como intenção (`acao_cliente`), nunca da transcrição.
 * A wake word usa o reconhecedor do aparelho só para achar "Ei AvisAI": o texto é descartado
 * na hora (não aparece, não é salvo nem enviado).
 */
export const VOICE_PRIVACY = {
  recordAudio: false,
  showTranscript: false,
  clientTranscriptCommands: false,
} as const;

/** Tempos dos comandos que encerram a conversa ou a conta: o agente se despede antes. */
export const VOICE_COMMANDS = {
  /** Espera o agente começar a se despedir (a ação chega antes do áudio). */
  farewellStartWaitMs: 4000,
  /** Limite para a despedida terminar antes de desligar mesmo assim. */
  farewellMaxMs: 10000,
  /** Mesma ação repetida dentro deste intervalo é ignorada. */
  dedupeMs: 2500,
} as const;

/** Layout responsivo (celular pequeno e fonte grande de acessibilidade). */
export const LAYOUT = {
  /** Abaixo desta largura útil (dp ÷ escala da fonte), colunas viram lista. */
  compactWidthDp: 340,
  /** Altura da linha de escrever da tela Mensagens: a esfera do AvisAI sobe acima dela. */
  messagesComposerDp: 80,
  /** Limite de aumento da fonte em rótulos curtos (abas), para não cortar a palavra. */
  tabLabelMaxScale: 1.15,
} as const;

/** Avisos do agente que chegam sem conversa aberta (`aviso_motorista`). */
export const DRIVER_NOTICES = {
  /** Aviso que é pergunta abre a conversa para o motorista responder. */
  openConversationOnQuestion: true,
  /** Pausa depois da fala local antes de liberar o microfone para a wake word. */
  tailMs: 500,
} as const;

/** Escuta da wake word ("Ei AvisAI") com o reconhecedor de fala do aparelho. */
export const WAKE_WORD = {
  /** Ligada por padrão; o motorista desliga nas configurações. */
  enabledByDefault: true,
  /**
   * Reconhecer sem internet quando o aparelho diz ter o idioma instalado. Desligado: no Galaxy A17
   * o modelo "instalado" devolve texto vazio. O reconhecedor padrão do Google é o que funciona.
   */
  preferOnDevice: false,
  /** Pausa antes de reabrir a escuta quando o reconhecedor encerra sozinho. */
  restartDelayMs: 400,
  /** Pausa maior depois de erro, para não ficar em laço. */
  errorBackoffMs: 3000,
  /** Tempo para o microfone ser liberado antes de a Agora assumir. */
  handoffMs: 350,
  /** Trechos de fala seguidos com texto vazio antes de trocar o reconhecimento no aparelho pelo padrão. */
  emptyResultsBeforeFallback: 2,
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
const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const rawVoiceMode = process.env.EXPO_PUBLIC_VOICE_MODE?.trim().toLowerCase();
const parsedRotaId = Number(process.env.EXPO_PUBLIC_ROTA_ID || 1);

export const ENV = {
  apiMode: (rawApiMode === 'http' ? 'http' : 'mock') as ApiMode,
  apiModeConfigured: rawApiMode === 'http' || rawApiMode === 'mock',
  apiBaseUrl: (rawApiBaseUrl || 'http://localhost:8000').replace(/\/+$/, ''),
  apiBaseUrlConfigured: Boolean(rawApiBaseUrl),
  rotaId: Number.isFinite(parsedRotaId) && parsedRotaId > 0 ? parsedRotaId : 1,
  voiceMode: (rawVoiceMode === 'agora' ? 'agora' : 'mock') as VoiceMode,
  hasGoogleMapsKey: readHasGoogleMapsKey(),
} as const;
