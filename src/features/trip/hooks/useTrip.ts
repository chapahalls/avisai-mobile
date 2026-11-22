import { create } from 'zustand';
import { BUSINESS, TIME_SCALE } from '../../../lib/config';
import { agentBus } from '../../../services/agentBus';
import { callReceiver, type ReceiverAnswer } from '../../../services/mockApi';
import { distanceKm, pathLengthKm, pointAt } from '../../../utils/geo';
import { enqueue } from '../../outbox';
import { ROUTE } from '../api/route.mock';
import { channelFor, shouldCallReceiver } from '../rules/escalation';
import { computeStay } from '../rules/stay';
import type { ReceiverStatus, TripPhase } from '../types';
import type { LatLng } from '../../../types/geo';

const SPEED_KMH = 80;

interface TripState {
  phase: TripPhase;
  progress: number;
  position: LatLng;
  /** Relógio simulado, em minutos desde o início. */
  simMinutes: number;
  arrivedAtMin: number | null;
  ccoAttempts: number;
  ccoAcknowledged: boolean;
  /** Demo: deixe false para mostrar o escalonamento até a ligação ao recebedor. */
  ccoWillRespond: boolean;
  receiver: ReceiverStatus;
  escalationCallDone: boolean;
  start: () => void;
  tick: (dtRealMs: number) => void;
  setCcoWillRespond: (v: boolean) => void;
  /** Demo: avança o relógio simulado (ex.: +1h para mostrar a estadia). */
  skip: (minutes: number) => void;
  reset: () => void;
}

const totalKm = pathLengthKm(ROUTE.path);
const id = ROUTE.tripId;

function receiverMessage(a: ReceiverAnswer) {
  if (a.kind === 'confirmed') return `O recebimento confirmou: doca ${a.dock}, ${a.time}.`;
  if (a.kind === 'not_today') return 'O recebimento disse que não recebe hoje. Avisei o CCO; siga a orientação da transportadora.';
  return 'O recebimento não atendeu. Registrei a tentativa como prova e avisei o CCO.';
}

const initial = {
  phase: 'idle' as TripPhase,
  progress: 0,
  position: ROUTE.origin.position,
  simMinutes: 0,
  arrivedAtMin: null,
  ccoAttempts: 0,
  ccoAcknowledged: false,
  ccoWillRespond: false,
  receiver: { kind: 'pending' } as ReceiverStatus,
  escalationCallDone: false,
};

export const useTrip = create<TripState>((set, get) => ({
  ...initial,

  start: () => {
    set({ ...initial, phase: 'pickup' });
    enqueue(id, 'RouteAssigned', { plate: ROUTE.plate, destination: ROUTE.destination.name }, 'system');
    agentBus.emit('agent:context', { context: 'pickup' });
    agentBus.emit('agent:say', { text: 'Você está no CD de origem. Confirma a retirada e me diz como está o caminhão?' });
  },

  tick: (dtRealMs) => {
    const s = get();
    const dMin = (dtRealMs / 1000) * (TIME_SCALE / 60);
    const simMinutes = s.simMinutes + dMin;

    if (s.phase === 'driving' || s.phase === 'approaching') {
      const progress = Math.min(1, s.progress + ((SPEED_KMH / 60) * dMin) / totalKm);
      const position = pointAt(ROUTE.path, progress);
      const leftKm = distanceKm(position, ROUTE.destination.position);
      set({ simMinutes, progress, position });

      if (s.phase === 'driving' && leftKm <= BUSINESS.approachKm) {
        set({ phase: 'approaching', receiver: { kind: 'calling' } });
        enqueue(id, 'ApproachDetected', { leftKm: Math.round(leftKm) }, 'system');
        enqueue(id, 'ReceiverNotified', { channel: 'ligação', plate: ROUTE.plate, eta: '15 min' }, 'agent');
        callReceiver('approach').then((a) => {
          set({ receiver: a });
          enqueue(id, 'ReceiverCallResult', { moment: 'approach', ...a }, 'agent');
          agentBus.emit('agent:say', { text: receiverMessage(a) });
        });
      }
      if (leftKm * 1000 <= BUSINESS.geofenceMeters || progress >= 1) {
        set({ phase: 'arrived' });
        agentBus.emit('agent:context', { context: 'checkin' });
        agentBus.emit('agent:say', { text: 'Chegou no destino. Me conta: como está a carga, teve avaria ou ocorrência?' });
      }
      return;
    }

    if (s.phase === 'waiting' && s.arrivedAtMin !== null) {
      set({ simMinutes });
      const waited = simMinutes - s.arrivedAtMin;
      const due = Math.floor(waited / BUSINESS.ccoAttemptIntervalMin);
      if (!s.ccoAcknowledged && due > s.ccoAttempts && s.ccoAttempts < BUSINESS.maxCcoAttempts) {
        const attempt = s.ccoAttempts + 1;
        set({ ccoAttempts: attempt });
        enqueue(id, 'TaskEscalated', { attempt, channel: channelFor(attempt) }, 'system');
        if (s.ccoWillRespond && attempt === 2) {
          set({ ccoAcknowledged: true });
          enqueue(id, 'TaskAcknowledged', { by: 'Operador CCO (mock)' }, 'cco');
          agentBus.emit('agent:say', { text: 'O CCO assumiu o seu caso e está falando com o recebimento.' });
        }
      }
      const after = get();
      if (shouldCallReceiver(after.ccoAttempts, after.ccoAcknowledged) && !after.escalationCallDone) {
        set({ escalationCallDone: true, receiver: { kind: 'calling' } });
        agentBus.emit('agent:say', { text: 'O CCO não respondeu em 3 tentativas. Estou ligando para o recebimento.' });
        callReceiver('escalation').then((a) => {
          set({ receiver: a });
          enqueue(id, 'ReceiverCallResult', { moment: 'escalation', ...a }, 'agent');
          agentBus.emit('agent:say', { text: receiverMessage(a) });
        });
      }
      return;
    }
    set({ simMinutes });
  },

  setCcoWillRespond: (v) => set({ ccoWillRespond: v }),
  skip: (minutes) => get().tick((minutes * 60 * 1000) / TIME_SCALE),
  reset: () => set({ ...initial }),
}));

/** Reage ao que o agente coletou por voz. Chamar uma vez no bootstrap. */
export function wireTripToVoice() {
  const offDone = agentBus.on('voice:completed', ({ context, fields }) => {
    const s = useTrip.getState();
    if (context === 'pickup') {
      enqueue(id, 'PickupConfirmed', {}, 'driver');
      enqueue(id, 'ReportSubmitted', { kind: 'inicial', fields }, 'driver');
      useTrip.setState({ phase: 'driving' });
    }
    if (context === 'checkin') {
      enqueue(id, 'ArrivalRegistered', { fields, simMinutes: Math.round(s.simMinutes) }, 'driver');
      enqueue(id, 'TaskCreated', { priority: 'baixa' }, 'system');
      useTrip.setState({ phase: 'waiting', arrivedAtMin: s.simMinutes });
      agentBus.emit('agent:context', { context: 'unload' });
    }
    if (context === 'unload') {
      const stay = computeStay(s.arrivedAtMin === null ? 0 : s.simMinutes - s.arrivedAtMin);
      enqueue(id, 'UnloadConfirmed', { ...stay }, 'driver');
      useTrip.setState({ phase: 'unloaded' });
    }
  });
  const offOcc = agentBus.on('voice:occurrence', ({ text }) => {
    enqueue(id, 'OccurrenceCreated', { text, position: useTrip.getState().position }, 'driver');
  });
  return () => {
    offDone();
    offOcc();
  };
}

/** Loop do simulador (GPS e relógio). */
export function startTripSimulator() {
  let last = Date.now();
  const timer = setInterval(() => {
    const now = Date.now();
    useTrip.getState().tick(now - last);
    last = now;
  }, 500);
  return () => clearInterval(timer);
}
