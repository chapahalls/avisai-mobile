import { create } from 'zustand';
import i18n from '../lib/i18n';
import { VOICE_COMMANDS } from '../lib/config';
import type { AppScreen, MensagensStream } from '../types/backend';
import { normalize } from '../utils/text';

export interface VoiceCommandToastState {
  message: string | null;
  show: (msg: string) => void;
  clear: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let lastExecutedKey = '';
let lastExecutedAt = 0;

function clearToastTimer() {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

export const useVoiceCommandToast = create<VoiceCommandToastState>((set) => ({
  message: null,
  show: (msg) => {
    clearToastTimer();
    set({ message: msg });
    toastTimer = setTimeout(() => {
      toastTimer = null;
      set({ message: null });
    }, 3500);
  },
  clear: () => {
    clearToastTimer();
    lastExecutedKey = '';
    lastExecutedAt = 0;
    set({ message: null });
  },
}));

export type ClientAction = MensagensStream['acao_cliente']['acao'];
export interface ClientActionOptions {
  tela?: AppScreen;
  documento?: string;
}

const isTest = () => Boolean(process.env.VITEST);
const toast = (key: string, opts?: Record<string, string>) =>
  useVoiceCommandToast.getState().show(i18n.t(key, opts));

// ---------- navegação ----------

const TAB_OF: Record<Exclude<AppScreen, 'fila'>, 'Trip' | 'Map' | 'Documents' | 'Messages'> = {
  inicio: 'Trip',
  mapa: 'Map',
  documentos: 'Documents',
  mensagens: 'Messages',
};

const SCREEN_TOAST: Record<AppScreen, string> = {
  inicio: 'voiceCommands.toast.backToTrip',
  mapa: 'voiceCommands.toast.openMap',
  documentos: 'voiceCommands.toast.openDocuments',
  mensagens: 'voiceCommands.toast.openMessages',
  fila: 'voiceCommands.toast.openQueue',
};

function nav() {
  if (isTest()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { navigationRef } = require('../app/navigation') as typeof import('../app/navigation');
    return navigationRef?.isReady() ? navigationRef : null;
  } catch {
    return null; // container de navegação ainda não montado
  }
}

function openScreen(screen: AppScreen): void {
  const ref = nav();
  if (!ref) return;
  if (screen === 'fila') ref.navigate('Queue');
  else ref.navigate('Main', { screen: TAB_OF[screen] });
}

function goBack(): void {
  const ref = nav();
  if (!ref) return;
  if (ref.canGoBack()) ref.goBack();
  else ref.navigate('Main', { screen: 'Trip' });
}

/** Abre o documento pedido; sem correspondência, abre a lista e avisa. */
function openDocument(name: string): boolean {
  if (isTest()) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const docsMod = require('../features/documents') as typeof import('../features/documents');
    const docs = docsMod.useDocuments.getState().documents;
    const doc = docsMod.findDocumentByName(docs.length ? docs : docsMod.DOCUMENTS, name);
    void docsMod.useDocuments.getState().syncFromBackend();
    if (doc) {
      nav()?.navigate('DocumentViewer', { id: doc.id });
      return true;
    }
  } catch {
    // segue para a lista
  }
  openScreen('documentos');
  return false;
}

// ---------- encerrar conversa e conta ----------

/**
 * A ação chega antes do áudio da despedida (o agente chama a ferramenta e só depois fala).
 * Espera ele começar e terminar de falar, com limites, e só então executa.
 */
function afterFarewell(run: () => void): void {
  if (isTest()) return; // nos testes só a intenção importa; voz e sessão não sobem
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useVoice } = require('../features/voice') as typeof import('../features/voice');
  let started = useVoice.getState().state === 'speaking';
  let done = false;
  let unsub: (() => void) | null = null;
  let startTimer: ReturnType<typeof setTimeout> | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;

  const finish = () => {
    if (done) return;
    done = true;
    unsub?.();
    if (startTimer) clearTimeout(startTimer);
    if (maxTimer) clearTimeout(maxTimer);
    run();
  };

  unsub = useVoice.subscribe((s) => {
    if (s.state === 'speaking') started = true;
    else if (started) finish();
  });
  startTimer = setTimeout(() => {
    if (!started) finish();
  }, VOICE_COMMANDS.farewellStartWaitMs);
  maxTimer = setTimeout(finish, VOICE_COMMANDS.farewellMaxMs);
}

function endVoice(): void {
  afterFarewell(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const voice = require('../features/voice') as typeof import('../features/voice');
    voice.useVoice.getState().stop();
    voice.useAvisaiDock.getState().closePanel();
  });
}

function logout(): void {
  afterFarewell(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const voice = require('../features/voice') as typeof import('../features/voice');
    voice.useAvisaiDock.getState().closePanel();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSession } = require('../features/auth') as typeof import('../features/auth');
    useSession.getState().logout();
  });
}

// ---------- viagem e GPS ----------

function startTripOrOpenTracking(): 'started' | 'opened' | null {
  if (isTest()) return 'started';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTrip } = require('../features/trip') as typeof import('../features/trip');
    const trip = useTrip.getState();
    if (trip.phase === 'idle') {
      trip.start();
      return 'started';
    }
    openScreen('inicio');
    return 'opened';
  } catch {
    return null;
  }
}

function tryStartGps(): boolean {
  if (isTest()) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useDeviceGps } = require('./deviceGps') as typeof import('./deviceGps');
    useDeviceGps.getState().setEnabled(true);
    return true;
  } catch {
    return false;
  }
}

// ---------- navegação até o destino e recado ao CCO ----------

function openNavigation(): void {
  if (isTest()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTrip } = require('../features/trip') as typeof import('../features/trip');
    const { lat, lng } = useTrip.getState().activeRoute.destination.position;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { openDirectionsTo } = require('./directions') as typeof import('./directions');
    void openDirectionsTo(lat, lng).then((ok) => {
      if (!ok) toast('voiceCommands.toast.navigationError');
    });
  } catch {
    toast('voiceCommands.toast.navigationError');
  }
}

/** Modo simulado: o recado vai pelo outbox, como a mensagem digitada na tela Mensagens. */
function sendToCco(text: string): void {
  if (isTest()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTrip } = require('../features/trip') as typeof import('../features/trip');
    useTrip.getState().sendDriverMessage(text);
  } catch {
    // sem viagem carregada: nada a enviar
  }
}

// ---------- telas de leitura só com o caminhão parado ----------

const READING_SCREENS: AppScreen[] = ['documentos', 'mensagens'];

/** Documentos e mensagens pedem leitura: em movimento, só voz (CTB art. 252). */
export function needsStop(action: ClientAction, opts: ClientActionOptions = {}): boolean {
  return (
    action === 'open_document' ||
    action === 'open_documents' ||
    (action === 'open_screen' && READING_SCREENS.includes(opts.tela ?? 'inicio'))
  );
}

function tripIsMoving(): boolean {
  if (isTest()) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTrip } = require('../features/trip') as typeof import('../features/trip');
    const { phase } = useTrip.getState();
    return phase === 'driving' || phase === 'approaching';
  } catch {
    return false;
  }
}

let movingProbe: () => boolean = tripIsMoving;
let pending: { action: ClientAction; opts: ClientActionOptions } | null = null;
let unsubPending: (() => void) | null = null;

/** Só para testes: simula o caminhão andando ou parado. */
export function setMovingProbeForTests(probe: (() => boolean) | null): void {
  movingProbe = probe ?? tripIsMoving;
  pending = null;
}

/** O que ficou esperando o caminhão parar. */
export function pendingWhileMoving(): { action: ClientAction; opts: ClientActionOptions } | null {
  return pending;
}

/** Executa o que ficou esperando, se o caminhão já parou. */
export function resumeWhenStopped(): boolean {
  if (!pending || movingProbe()) return false;
  const p = pending;
  pending = null;
  unsubPending?.();
  unsubPending = null;
  lastExecutedKey = '';
  return executeClientAction(p.action, p.opts);
}

function deferUntilStopped(action: ClientAction, opts: ClientActionOptions): void {
  pending = { action, opts };
  if (unsubPending || isTest()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTrip } = require('../features/trip') as typeof import('../features/trip');
    unsubPending = useTrip.subscribe(() => {
      resumeWhenStopped();
    });
  } catch {
    // sem viagem: fica pendente até o próximo comando
  }
}

function isDuplicate(key: string): boolean {
  const now = Date.now();
  if (key === lastExecutedKey && now - lastExecutedAt < VOICE_COMMANDS.dedupeMs) return true;
  lastExecutedKey = key;
  lastExecutedAt = now;
  return false;
}

/**
 * Executa uma ação explícita enviada pelo backend (`acao_cliente`). A voz é interpretada no
 * servidor; o cliente recebe somente a intenção autorizada, sem transcrição.
 */
export function executeClientAction(action: ClientAction, opts: ClientActionOptions = {}): boolean {
  if (isDuplicate(`action:${action}:${opts.tela ?? ''}:${opts.documento ?? ''}`)) return false;

  if (needsStop(action, opts) && movingProbe()) {
    deferUntilStopped(action, opts);
    toast('voiceCommands.toast.deferredWhileMoving');
    return true;
  }

  switch (action) {
    case 'open_screen': {
      const screen = opts.tela ?? 'inicio';
      if (!(screen in SCREEN_TOAST)) return false;
      openScreen(screen);
      toast(SCREEN_TOAST[screen]);
      return true;
    }
    case 'open_documents':
      openScreen('documentos');
      toast('voiceCommands.toast.openDocuments');
      return true;
    case 'open_document': {
      const name = opts.documento?.trim();
      if (!name) {
        openScreen('documentos');
        toast('voiceCommands.toast.openDocuments');
        return true;
      }
      const found = openDocument(name);
      toast(found ? 'voiceCommands.toast.openDocument' : 'voiceCommands.toast.documentNotFound', { name });
      return true;
    }
    case 'open_map':
      openScreen('mapa');
      toast('voiceCommands.toast.openMap');
      return true;
    case 'go_back':
      goBack();
      toast('voiceCommands.toast.goBack');
      return true;
    case 'end_voice':
      toast('voiceCommands.toast.endVoice');
      endVoice();
      return true;
    case 'logout':
      toast('voiceCommands.toast.logout');
      logout();
      return true;
    case 'open_navigation':
      openNavigation();
      toast('voiceCommands.toast.openNavigation');
      return true;
    case 'start_gps':
      if (!tryStartGps()) return false;
      toast('voiceCommands.toast.startGps');
      return true;
    case 'start_trip': {
      const result = startTripOrOpenTracking();
      if (!result) return false;
      toast(result === 'started' ? 'voiceCommands.toast.startTrip' : 'voiceCommands.toast.backToTrip');
      return true;
    }
  }
  return false;
}

// ---------- modo simulado (sem backend): a fala vira a mesma ação ----------

const VERB = /\b(abr\w*|mostr\w*|ver|veja|exib\w*|(mud|troc|pass)\w* (pras?|para|pros?)|ir (pras?|para|pros?|ao|as?|nos?|nas?)|vai (pras?|para|pros?)|volt\w* (pras?|para|pros?|ao|as?)|open|show|go( back)? to)\b/;
const START_TRIP_RE = /(inici(ar|e)|comec(ar|e)|start).*(viagem|rota|trip|route)/;
const START_GPS_RE =
  /(inici(ar|e)|ativ(ar|e)|lig(ar|e)|start|enable|turn on).*(gps|localiza[cç][aã]o|rastreamento|tracking|location)/;
const DOC_FIELD_RE = /\b(peso|valor|numero|chave|destinatario|emitente|frete|placa|weight|value|number)\b/;
const NFE_RE = /\bnota( fiscal)?\b|\bnf-?e\b|\bnf\b|\binvoice\b/;
const CTE_RE = /\bct-?e\b|\bconhecimento\b/;
const END_VOICE_RE =
  /\b(encerr|finaliz|termin|deslig|fech)\w* (a |essa |esta )?(conversa|ligacao|chamada|sessao|voz)\b|\b(tchau|ate mais|bye)\b.*\bavis\s?a?\s?a?i\b|\bpode (desligar|encerrar)\b|\b(end|stop) (the )?(conversation|call)\b/;
const LOGOUT_CONFIRMED_RE = /\bconfirm\w*\b.*\b(sair|logout|log out|deslog)/;
const LOGOUT_RE = /\b(sair|saia|sai) da (minha )?conta\b|\bfaz(er)? logout\b|\bdeslog\w*\b|\blog ?out\b|\bsign out\b/;
const NAVIGATE_RE =
  /\bme lev\w*\b|\bnaveg\w* (ate|pras?|pros?|para)\b|\bcomo (eu )?chego\b|\babr\w* (o )?(google maps|waze|navegacao)\b|\b(take me|navigate) to\b/;
const MESSAGE_CCO_RE =
  /\b(?:avis\w*|fal\w*|diz\w*|manda\w*(?: uma)?(?: mensagem| recado)?) (?:pro|pra|para o|ao|o)? ?(?:cco|central|operador)\b[,:]?\s*(?:que\s+)?(.+)/;
const SCREENS: Array<[AppScreen, RegExp]> = [
  ['fila', /\bfila (do|no|da) (recebedor|recebimento|doca|descarga)\b|\bdoca\b|\breceiver queue\b|\bdock\b/],
  ['mensagens', /\bmensage(m|ns)\b|\bmessages?\b|\bfila\b|\boutbox\b|\bsincroniza\w*|\bsync\b|\bchat\b/],
  ['mapa', /\bmapa\b|\brota\b|\bmap\b|\broute\b/],
  ['documentos', /\bdocument\w*\b|\barquivo\w*\b|\banexo\w*\b|\bfiles?\b|\battachments?\b|\bpdf\b/],
  ['inicio', /\binicio\b|\bviagem\b|\bestadia\b|\bhome\b|\btrip\b|\bstay\b/],
];

/**
 * Modo simulado: a fala digitada/tocada nos chips vira a mesma ação que o backend mandaria.
 * Na voz real (Agora) o app não lê transcrição; quem decide é o agente no servidor.
 */
export function tryExecuteVoiceCommand(text: string): boolean {
  const norm = normalize(text || '').trim();
  if (!norm) return false;

  if (LOGOUT_CONFIRMED_RE.test(norm)) return executeClientAction('logout');
  if (LOGOUT_RE.test(norm)) {
    toast('voiceCommands.toast.logoutConfirmHint');
    return true;
  }
  if (END_VOICE_RE.test(norm)) return executeClientAction('end_voice');
  if (START_TRIP_RE.test(norm)) return executeClientAction('start_trip');
  if (START_GPS_RE.test(norm)) return executeClientAction('start_gps');
  if (NAVIGATE_RE.test(norm)) return executeClientAction('open_navigation');
  const message = MESSAGE_CCO_RE.exec(norm);
  if (message?.[1]?.trim()) {
    // normalize() preserva o comprimento: recorta a fala original, com acentos.
    const original = text.trim().slice(message.index + message[0].length - message[1].length).trim();
    sendToCco(original);
    toast('voiceCommands.toast.messageSent');
    return true;
  }
  if (/^(volt\w*|go back|back)$/.test(norm)) return executeClientAction('go_back');
  if (!VERB.test(norm) || DOC_FIELD_RE.test(norm)) return false;

  if (NFE_RE.test(norm)) return executeClientAction('open_document', { documento: 'NF-e' });
  if (CTE_RE.test(norm)) return executeClientAction('open_document', { documento: 'CT-e' });
  for (const [screen, re] of SCREENS) {
    if (re.test(norm)) return executeClientAction('open_screen', { tela: screen });
  }
  return false;
}
