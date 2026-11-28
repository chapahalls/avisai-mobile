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

/**
 * Fila offline (outbox): reenvio com backoff exponencial, um item por vez e em ordem FIFO.
 * Erros 4xx definitivos (pedido inválido, rota de outro motorista, recurso inexistente) não
 * se resolvem tentando de novo: o item vira `failed` na hora e a fila segue.
 */
export const OUTBOX = {
  /** Tentativas antes de o item virar `failed`. */
  maxAttempts: 8,
  /** Espera antes da tentativa n: 2^n s, até este teto. */
  maxBackoffMs: 60_000,
  /** Erros 4xx que valem nova tentativa: token vencido, tempo esgotado e excesso de pedidos. */
  retryableClientStatus: [401, 408, 425, 429] as readonly number[],
} as const;

/** Relógio simulado: 1 s real = TIME_SCALE s simulados (60 = 1 s vira 1 min). */
export const TIME_SCALE = 60;

/**
 * Voz RTC direta (com rede): sem gravação nem legendas/transcrição consumidas pelo cliente.
 * Sem rede é diferente: o app grava cada fala em WAV até o envio (ver OFFLINE_VOICE).
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

/**
 * Modo direção (como o Waze): a velocidade do GPS diz se o caminhão está andando. Andando, a tela
 * trava e só a voz funciona (CTB art. 252); parado, tudo volta. Os dois limiares e as esperas
 * evitam que a tela pisque no anda-e-para do trânsito.
 */
export const DRIVING_MODE = {
  enabled: true,
  /** Acima desta velocidade, por `enterHoldMs` seguidos, entra no modo direção. */
  enterKmh: 10,
  enterHoldMs: 4000,
  /** Abaixo desta velocidade, por `exitHoldMs` seguidos, considera parado e libera a tela. */
  exitKmh: 3,
  exitHoldMs: 5000,
  /** O GPS só manda posição nova depois de andar (filtro de distância): sem posição há este tempo = parado. */
  staleFixMs: 15000,
  /** Frequência da checagem. */
  tickMs: 1000,
} as const;

/** Esfera flutuante do AvisAI: o motorista arrasta para onde quiser e a posição fica salva. */
export const AVISAI_ORB = {
  sizeDp: 76,
  /** Distância mínima da esfera até a borda da tela. */
  edgeMarginDp: 8,
  /** Abaixo deste deslocamento o gesto é toque (abre o painel), acima é arrastar. */
  dragSlopDp: 8,
  /** Chave em `settings` (SQLite) com a posição salva. */
  settingKey: 'avisai_orb_position',
} as const;

/** Avisos do agente que chegam sem conversa aberta (`aviso_motorista`). */
export const DRIVER_NOTICES = {
  /** Aviso que é pergunta abre a conversa para o motorista responder. */
  openConversationOnQuestion: true,
  /** Pausa depois da fala local antes de liberar o microfone para a wake word. */
  tailMs: 500,
} as const;

/** Escuta da wake word ("Ei AvisAI") com o reconhecedor de fala do aparelho. */
/**
 * Sem rede (offline-first): o app não roda modelo de voz. Grava cada fala do motorista em WAV,
 * põe na fila e o backend transcreve e processa quando a rede volta. A fala é separada só pelo
 * volume do microfone (sem modelo): começa quando passa do limiar e termina depois de um silêncio.
 */
export const OFFLINE_VOICE = {
  sampleRate: 16000,
  /** Tamanho de cada análise de volume. */
  frameMs: 20,
  /** Quadros seguidos acima do limiar para contar como início de fala. */
  startFrames: 4,
  /** Volume mínimo (RMS em PCM 16 bits) para ser fala, mesmo em cabine silenciosa. */
  minThreshold: 700,
  /** O limiar acompanha o ruído da cabine: fala = ruído médio × este fator. */
  noiseFactor: 2.5,
  /** Silêncio que encerra a fala. */
  silenceMs: 1300,
  /** Abaixo disso (fala útil) a gravação é descartada: tosse, batida, buzina. */
  minSpeechMs: 400,
  /** Uma fala longa vira mais de um áudio. */
  maxClipMs: 30000,
  /** Áudio guardado antes do início detectado, para não cortar a primeira sílaba. */
  preRollMs: 300,
  /** Início de cada escuta: mede o ruído da cabine antes de procurar fala. */
  calibrationMs: 300,
  /** Pasta (dentro dos documentos do app) onde os áudios esperam a rede. */
  folder: 'falas_offline',
} as const;

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
  /** Tempo para o microfone ser liberado antes de o LiveKit assumir. */
  handoffMs: 350,
  /** Trechos de fala seguidos com texto vazio antes de trocar o reconhecimento no aparelho pelo padrão. */
  emptyResultsBeforeFallback: 2,
} as const;

export type ApiMode = 'mock' | 'http';
export type VoiceMode = 'mock' | 'livekit';
export type AuthMode = 'mock' | 'keycloak';

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
const rawAuthMode = process.env.EXPO_PUBLIC_AUTH_MODE?.trim().toLowerCase();
const parsedRotaId = Number(process.env.EXPO_PUBLIC_ROTA_ID || 1);

export const ENV = {
  apiMode: (rawApiMode === 'http' ? 'http' : 'mock') as ApiMode,
  apiModeConfigured: rawApiMode === 'http' || rawApiMode === 'mock',
  apiBaseUrl: (rawApiBaseUrl || 'http://localhost:8000').replace(/\/+$/, ''),
  apiBaseUrlConfigured: Boolean(rawApiBaseUrl),
  rotaId: Number.isFinite(parsedRotaId) && parsedRotaId > 0 ? parsedRotaId : 1,
  voiceMode: (rawVoiceMode === 'livekit' ? 'livekit' : 'mock') as VoiceMode,
  hasGoogleMapsKey: readHasGoogleMapsKey(),
  /** mock = SSO do ApiClient (padrão); keycloak = OIDC Authorization Code + PKCE no realm `rodar` (rodarglobal/rodar-keycloak). */
  authMode: (rawAuthMode === 'keycloak' ? 'keycloak' : 'mock') as AuthMode,
  /** Issuer do realm. No celular, use o IP da máquina na rede local (ou adb reverse), não localhost. */
  keycloakIssuer: (
    process.env.EXPO_PUBLIC_KEYCLOAK_ISSUER?.trim() || 'http://localhost:8180/realms/rodar'
  ).replace(/\/+$/, ''),
  keycloakClientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID?.trim() || 'rodar-mobile',
} as const;

/**
 * Escopos pedidos ao Keycloak. offline_access mantém o motorista logado sem rede; organization:* traz todas as
 * transportadoras da pessoa sem tela de escolha (o agregado não escolhe: o backend sabe de quem é a viagem).
 */
export const KEYCLOAK_SCOPES = ['openid', 'profile', 'email', 'offline_access', 'organization:*'] as const;
