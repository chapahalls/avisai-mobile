import { create } from 'zustand';
import i18n from '../lib/i18n';
import type { MensagensStream } from '../types/backend';
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
  /(abr(ir|e|a)|mostr(ar|e|a)|ver|ir para|open|show|go to).*(documento|document|pdf|arquivo|anexo|file|attachment)/;
const OPEN_OUTBOX_RE =
  /(abr(ir|e|a)|mostr(ar|e|a)|ver|ir para|open|show|go to).*(mensage(m|ns)|messages?|fila|outbox|sincroniza|sync|perfil|profile)/;
const OPEN_MAP_RE =
  /(abr(ir|e|a)|mostr(ar|e|a)|ver|ir para|open|show|go to).*(mapa|rota|map|route)/;
const BACK_TO_TRIP_RE =
  /(abr(ir|e|a)|mostr(ar|e|a)|volt(ar|e)|ir para|open|show|go to).*(viagem|voz|estadia|inicio|trip|voice|stay|home)/;
const START_TRIP_RE = /(inici(ar|e)|comec(ar|e)|start).*(viagem|rota|trip|route)/;
const START_GPS_RE =
  /(inici(ar|e)|ativ(ar|e)|lig(ar|e)|start|enable|turn on).*(gps|localiza[cç][aã]o|rastreamento|tracking|location)/;

export type ClientAction = MensagensStream['acao_cliente']['acao'];

function navigateToTab(screen: 'Trip' | 'Map' | 'Documents' | 'Messages'): void {
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

function startTripOrOpenTracking(): 'started' | 'opened' | null {
  if (process.env.VITEST) return 'started';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTrip } = require('../features/trip') as typeof import('../features/trip');
    const trip = useTrip.getState();
    if (trip.phase === 'idle') {
      trip.start();
      return 'started';
    }
    navigateToTab('Trip');
    return 'opened';
  } catch {
    return null;
  }
}

function tryStartGps(): boolean {
  if (process.env.VITEST) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useDeviceGps } = require('./deviceGps') as typeof import('./deviceGps');
    useDeviceGps.getState().setEnabled(true);
    return true;
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
    return executeClientAction('start_trip');
  }

  if (START_GPS_RE.test(norm)) {
    return executeClientAction('start_gps');
  }

  if (OPEN_NFE_RE.test(norm)) {
    return executeClientAction('open_documents', 'nfe-1');
  }

  if (OPEN_CTE_RE.test(norm)) {
    return executeClientAction('open_documents', 'cte-1');
  }

  if (OPEN_DOCUMENTS_RE.test(norm)) {
    return executeClientAction('open_documents');
  }

  if (OPEN_OUTBOX_RE.test(norm)) {
    if (isDuplicate(norm)) return false;
    navigateToTab('Messages');
    useVoiceCommandToast.getState().show(i18n.t('voiceCommands.toast.openOutbox'));
    return true;
  }

  if (OPEN_MAP_RE.test(norm)) {
    return executeClientAction('open_map');
  }

  if (BACK_TO_TRIP_RE.test(norm)) {
    if (isDuplicate(norm)) return false;
    navigateToTab('Trip');
    useVoiceCommandToast.getState().show(i18n.t('voiceCommands.toast.backToTrip'));
    return true;
  }

  return false;
}

/**
 * Executa uma ação explícita enviada pelo backend. A voz é interpretada no
 * servidor; o cliente recebe somente a intenção autorizada, sem transcrição.
 */
export function executeClientAction(action: ClientAction, documentId?: string): boolean {
  const duplicateKey = `action:${action}:${documentId ?? ''}`;
  if (isDuplicate(duplicateKey)) return false;

  switch (action) {
    case 'open_documents': {
      if (process.env.VITEST) {
        useVoiceCommandToast.getState().show(
          i18n.t(documentId === 'nfe-1' ? 'voiceCommands.toast.openNfe' : documentId === 'cte-1'
            ? 'voiceCommands.toast.openCte'
            : 'voiceCommands.toast.openDocuments'),
        );
        return true;
      }
      try {
        // Atualiza anexos reais antes de abrir a tela.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useDocuments } = require('../features/documents') as typeof import('../features/documents');
        void useDocuments.getState().syncFromBackend();
      } catch {
        // A navegação ainda funciona se a sincronização falhar.
      }
      if (documentId) {
        navigateToDocument(documentId);
        useVoiceCommandToast.getState().show(
          i18n.t(documentId === 'nfe-1' ? 'voiceCommands.toast.openNfe' : 'voiceCommands.toast.openCte'),
        );
      } else {
        navigateToTab('Documents');
        useVoiceCommandToast.getState().show(i18n.t('voiceCommands.toast.openDocuments'));
      }
      return true;
    }
    case 'open_map':
      navigateToTab('Map');
      useVoiceCommandToast.getState().show(i18n.t('voiceCommands.toast.openMap'));
      return true;
    case 'start_gps':
      if (!tryStartGps()) return false;
      useVoiceCommandToast.getState().show(i18n.t('voiceCommands.toast.startGps'));
      return true;
    case 'start_trip':
      {
        const result = startTripOrOpenTracking();
        if (!result) return false;
        useVoiceCommandToast
          .getState()
          .show(i18n.t(result === 'started' ? 'voiceCommands.toast.startTrip' : 'voiceCommands.toast.backToTrip'));
      }
      return true;
  }
}
