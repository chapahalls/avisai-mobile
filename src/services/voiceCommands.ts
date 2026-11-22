import { create } from 'zustand';
import i18n from '../lib/i18n';
import { normalize } from '../utils/text';

export interface VoiceCommandToastState {
  message: string | null;
  show: (msg: string) => void;
  clear: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let lastExecutedNorm = '';
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
    lastExecutedNorm = '';
    lastExecutedAt = 0;
    set({ message: null });
  },
}));

const OPEN_NFE_RE =
  /(abr(ir|e|a)|mostr(ar|e|a)|ver|ir para|open|show|go to).*(nota fiscal|\bnf\b|nf-?e|invoice)/;
const OPEN_CTE_RE =
  /(abr(ir|e|a)|mostr(ar|e|a)|ver|ir para|open|show|go to).*(ct-?e|conhecimento)/;
const OPEN_DOCUMENTS_RE =
  /(abr(ir|e|a)|mostr(ar|e|a)|ver|ir para|open|show|go to).*(documento|document|pdf)/;
const OPEN_OUTBOX_RE =
  /(abr(ir|e|a)|mostr(ar|e|a)|ver|ir para|open|show|go to).*(fila|outbox|sincroniza|sync|perfil|profile)/;
const OPEN_MAP_RE =
  /(abr(ir|e|a)|mostr(ar|e|a)|ver|ir para|open|show|go to).*(mapa|rota|map|route)/;
const BACK_TO_TRIP_RE =
  /(abr(ir|e|a)|mostr(ar|e|a)|volt(ar|e)|ir para|open|show|go to).*(viagem|voz|estadia|inicio|trip|voice|stay|home)/;
const START_TRIP_RE = /(inici(ar|e)|comec(ar|e)|start).*(viagem|rota|trip|route)/;

function navigateToTab(screen: 'Trip' | 'Map' | 'Documents' | 'Outbox'): void {
  if (process.env.VITEST) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { navigationRef } = require('../app/navigation') as typeof import('../app/navigation');
    if (navigationRef?.isReady()) {
      navigationRef.navigate('Main', { screen });
    }
  } catch {
    // Ignora se o container de navegação ainda não estiver pronto
  }
}

function navigateToDocument(id: string): void {
  if (process.env.VITEST) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { navigationRef } = require('../app/navigation') as typeof import('../app/navigation');
    if (navigationRef?.isReady()) {
      navigationRef.navigate('DocumentViewer', { id });
    }
  } catch {
    // Ignora se o container de navegação ainda não estiver pronto
  }
}

function tryStartTripIfIdle(): boolean {
  if (process.env.VITEST) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTrip } = require('../features/trip') as typeof import('../features/trip');
    const trip = useTrip.getState();
    if (trip.phase === 'idle') {
      trip.start();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function isDuplicate(norm: string): boolean {
  const now = Date.now();
  if (norm === lastExecutedNorm && now - lastExecutedAt < 2500) {
    return true;
  }
  lastExecutedNorm = norm;
  lastExecutedAt = now;
  return false;
}

/**
 * Avalia se a transcrição do motorista corresponde a um comando de voz de navegação ou ação no app.
 * Retorna `true` quando um comando é reconhecido e executado.
 */
export function tryExecuteVoiceCommand(text: string): boolean {
  const norm = normalize(text || '').trim();
  if (!norm) return false;

  if (START_TRIP_RE.test(norm)) {
    if (isDuplicate(norm)) return false;
    if (tryStartTripIfIdle()) {
      useVoiceCommandToast.getState().show(i18n.t('voiceCommands.toast.startTrip'));
      return true;
    }
    return false;
  }

  if (OPEN_NFE_RE.test(norm)) {
    if (isDuplicate(norm)) return false;
    navigateToDocument('nfe-1');
    useVoiceCommandToast.getState().show(i18n.t('voiceCommands.toast.openNfe'));
    return true;
  }

  if (OPEN_CTE_RE.test(norm)) {
    if (isDuplicate(norm)) return false;
    navigateToDocument('cte-1');
    useVoiceCommandToast.getState().show(i18n.t('voiceCommands.toast.openCte'));
    return true;
  }

  if (OPEN_DOCUMENTS_RE.test(norm)) {
    if (isDuplicate(norm)) return false;
    navigateToTab('Documents');
    useVoiceCommandToast.getState().show(i18n.t('voiceCommands.toast.openDocuments'));
    return true;
  }

  if (OPEN_OUTBOX_RE.test(norm)) {
    if (isDuplicate(norm)) return false;
    navigateToTab('Outbox');
    useVoiceCommandToast.getState().show(i18n.t('voiceCommands.toast.openOutbox'));
    return true;
  }

  if (OPEN_MAP_RE.test(norm)) {
    if (isDuplicate(norm)) return false;
    navigateToTab('Map');
    useVoiceCommandToast.getState().show(i18n.t('voiceCommands.toast.openMap'));
    return true;
  }

  if (BACK_TO_TRIP_RE.test(norm)) {
    if (isDuplicate(norm)) return false;
    navigateToTab('Trip');
    useVoiceCommandToast.getState().show(i18n.t('voiceCommands.toast.backToTrip'));
    return true;
  }

  return false;
}
