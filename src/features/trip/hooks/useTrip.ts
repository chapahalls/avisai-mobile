import { create } from 'zustand';
import { useHeadsUpBanner } from '../../../components/HeadsUpBanner';
import { BUSINESS, TIME_SCALE } from '../../../lib/config';
import i18n from '../../../lib/i18n';
import { newId } from '../../../lib/id';
import { agentBus } from '../../../services/agentBus';
import { getApiClient, useApiConfig } from '../../../services/api';
import type { ReceiverAnswer } from '../../../services/apiClient';
import type {
  Estadia,
  EventoStream,
  Ligacao,
  MensagensStream,
  Snapshot,
  StatusRota,
  TaskCCO,
} from '../../../types/backend';
import type { LatLng } from '../../../types/geo';
import { distanceKm, pathLengthKm, pointAt } from '../../../utils/geo';
import { useDocuments } from '../../documents';
import { enqueue } from '../../outbox';
import { ROUTE } from '../api/route.mock';
import { channelFor, shouldCallReceiver } from '../rules/escalation';
import { computeStay } from '../rules/stay';
import type {
  CentralRequestState,
  ReceiverStatus,
  RouteMock,
  TimelineEntry,
  TimelineTone,
  TripPhase,
} from '../types';

const SPEED_KMH = 80;
const BASE_SIM_HOUR = 14;
let centralClearTimer: ReturnType<typeof setTimeout> | null = null;
let lastRouteSyncRequest = 0;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatTimelineTime(simMinutes: number, timestampIso?: string): string {
  if (timestampIso) {
    const match = timestampIso.match(/T(\d{2}:\d{2})/);
    if (match?.[1]) return match[1];
  }
  const totalMin = BASE_SIM_HOUR * 60 + Math.max(0, Math.round(simMinutes));
  const hh = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
  const mm = String(totalMin % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function appendTimeline(
  list: TimelineEntry[],
  label: string,
  tone: TimelineTone,
  simMinutes: number,
  timestampIso?: string,
): TimelineEntry[] {
  const clean = label.trim();
  if (!clean) return list;
  const time = formatTimelineTime(simMinutes, timestampIso);
  const last = list[list.length - 1];
  if (last && last.label === clean && last.time === time) {
    return list;
  }
  return [...list, { id: newId(), time, label: clean, tone }].slice(-40);
}

export function statusRotaToPhase(status: StatusRota, _currentPhase?: TripPhase): TripPhase {
  switch (status) {
    case 'publicada':
    case 'planejada':
      return 'idle';
    case 'na_origem':
      return 'pickup';
    case 'em_transito':
      return 'driving';
    case 'aproximando':
      return 'approaching';
    case 'no_destino':
      return 'waiting';
    case 'descarregada':
      return 'unloaded';
  }
}

function ligacaoToReceiverStatus(
  lig: Ligacao | null | undefined,
  task?: TaskCCO | null,
): ReceiverStatus | null {
  if (lig) {
    if (lig.status === 'respondida') {
      return {
        kind: 'confirmed',
        dock: lig.doca || '1',
        time: lig.previsao || lig.resposta_resumo || 'confirmado',
      };
    }
    if (lig.status === 'em_andamento' || lig.status === 'chamando') {
      return { kind: 'calling' };
    }
    if (lig.status === 'nao_atendida' || lig.status === 'falhou') {
      return { kind: 'no_answer' };
    }
  }
  if (task?.resposta_recebedor) {
    return {
      kind: 'confirmed',
      dock: '1',
      time: task.resposta_recebedor,
    };
  }
  return null;
}

interface TripState {
  phase: TripPhase;
  progress: number;
  position: LatLng;
  activeRoute: RouteMock;
  /** Relógio simulado, em minutos desde o início. */
  simMinutes: number;
  arrivedAtMin: number | null;
  unloadedAtMin: number | null;
  ccoAttempts: number;
  ccoAcknowledged: boolean;
  /** Demo: deixe false para mostrar o escalonamento até a ligação ao recebedor. */
  ccoWillRespond: boolean;
  receiver: ReceiverStatus;
  escalationCallDone: boolean;
  /** Estado em tempo real vindo do backend oficial via WebSocket (/ws). */
  backendStay: Estadia | null;
  backendTask: TaskCCO | null;
  backendLigacao: Ligacao | null;
  centralRequest: CentralRequestState | null;
  gpsDivergence: string | null;
  routeAssignedBanner: string | null;
  etaMin: number | null;
  speedKmh: number | null;
  timeline: TimelineEntry[];
  addTimelineEntry: (label: string, tone: TimelineTone, timestampIso?: string) => void;
  quickArrive: () => void;
  quickReportQueue: () => void;
  /** Mensagem livre do motorista ao CCO: entra no outbox e na linha do tempo. */
  sendDriverMessage: (text: string) => void;
  quickUnload: () => void;
  start: () => void;
  tick: (dtRealMs: number) => void;
  setCcoWillRespond: (v: boolean) => void;
  /** Demo: avança o relógio simulado (ex.: +1h para mostrar a estadia). */
  skip: (minutes: number) => void;
  /** Demo: salta direto para o limiar de aproximação (8 km do destino). */
  jumpToApproach: () => void;
  /** Demo: salta direto para a chegada na geocerca do destino (300 m). */
  jumpToArrival: () => void;
  reset: () => void;
  syncRouteFromBackend: (rotaId?: number) => Promise<void>;
  setCentralRequest: (req: CentralRequestState | null) => void;
  setGpsDivergence: (msg: string | null) => void;
  clearRouteAssignedBanner: () => void;
  applyBackendSnapshot: (snap: Snapshot) => void;
  applyBackendPosicao: (pos: MensagensStream['posicao']) => void;
  applyBackendContador: (estadias: Estadia[]) => void;
  applyBackendTask: (task: TaskCCO) => void;
  applyBackendEvento: (evento: EventoStream) => void;
  applyBackendReset: () => void;
}

let currentRunId = 0;

function receiverMessage(a: Exclude<ReceiverAnswer, { kind: 'calling' }>): string {
  if (a.kind === 'confirmed') {
    return i18n.t('trip.voice.receiverConfirmed', { dock: a.dock, time: a.time });
  }
  if (a.kind === 'not_today') {
    return i18n.t('trip.voice.receiverNotToday');
  }
  return i18n.t('trip.voice.receiverNoAnswer');
}

function findProgressForRemainingKm(route: RouteMock, targetKm: number): number {
  for (let step = 1; step <= 200; step++) {
    const p = step / 200;
    const pos = pointAt(route.path, p);
    const left = distanceKm(pos, route.destination.position);
    if (left <= targetKm) return p;
  }
  return 1;
}

function computeProgressFromPosition(pos: LatLng, route: RouteMock): number {
  const totalKm = pathLengthKm(route.path);
  const leftKm = distanceKm(pos, route.destination.position);
  if (totalKm <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - leftKm / totalKm));
}

function normalizePolylinePoint(point: unknown): LatLng | null {
  if (Array.isArray(point) && point.length >= 2) {
    const [lat, lng] = point;
    if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
    return null;
  }
  if (point && typeof point === 'object') {
    const { lat, lng } = point as { lat?: unknown; lng?: unknown };
    if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }
  return null;
}

const initial = {
  phase: 'idle' as TripPhase,
  progress: 0,
  position: ROUTE.origin.position,
  activeRoute: ROUTE,
  simMinutes: 0,
  arrivedAtMin: null as number | null,
  unloadedAtMin: null as number | null,
  ccoAttempts: 0,
  ccoAcknowledged: false,
  ccoWillRespond: false,
  receiver: { kind: 'pending' } as ReceiverStatus,
  escalationCallDone: false,
  backendStay: null as Estadia | null,
  backendTask: null as TaskCCO | null,
  backendLigacao: null as Ligacao | null,
  centralRequest: null as CentralRequestState | null,
  gpsDivergence: null as string | null,
  routeAssignedBanner: null as string | null,
  etaMin: null as number | null,
  speedKmh: null as number | null,
  timeline: [] as TimelineEntry[],
};

export const useTrip = create<TripState>((set, get) => ({
  ...initial,

  addTimelineEntry: (label, tone, timestampIso) => {
    set((s) => ({
      timeline: appendTimeline(s.timeline, label, tone, s.simMinutes, timestampIso),
    }));
  },

  quickArrive: () => {
    const s = get();
    const tripId = s.activeRoute.tripId;
    const rotaId = useApiConfig.getState().rotaId;
    if (useApiConfig.getState().mode === 'http') {
      void getApiClient().registerArrival(rotaId).catch(() => undefined);
    }
    const arrivedAtMin = s.arrivedAtMin ?? s.simMinutes;
    enqueue(
      tripId,
      'ArrivalRegistered',
      { fields: { status_carga: 'ok', avarias: 'não', ocorrencias: 'não' }, simMinutes: Math.round(s.simMinutes) },
      'driver',
    );
    enqueue(tripId, 'TaskCreated', { priority: 'baixa' }, 'system');
    set((curr) => ({
      phase: 'waiting',
      progress: 1,
      position: curr.activeRoute.destination.position,
      arrivedAtMin,
      etaMin: 0,
      speedKmh: 0,
      timeline: appendTimeline(
        appendTimeline(
          curr.timeline,
          i18n.t('trip.timeline.arrivalConfirmed'),
          'ok',
          curr.simMinutes,
        ),
        i18n.t('trip.timeline.ccoTaskCreated'),
        'brand',
        curr.simMinutes,
      ),
    }));
    agentBus.emit('agent:context', { context: 'unload' });
    agentBus.emit('agent:say', { text: i18n.t('voice.agent.done.checkin') });
  },

  quickReportQueue: () => {
    const s = get();
    const text = i18n.t('trip.quickActions.queueReportText');
    enqueue(
      s.activeRoute.tripId,
      'OccurrenceCreated',
      { text, descricao: text, position: s.position },
      'driver',
    );
    set((curr) => ({
      timeline: appendTimeline(
        curr.timeline,
        i18n.t('trip.timeline.occurrenceReported', { text }),
        'wait',
        curr.simMinutes,
      ),
    }));
    agentBus.emit('agent:say', { text: i18n.t('voice.agent.occurrenceRecorded') });
  },

  sendDriverMessage: (text) => {
    const clean = text.trim();
    if (!clean) return;
    const s = get();
    // Mesmo evento da ocorrência relatada por voz: é crítico e sai mesmo com rede fraca.
    enqueue(
      s.activeRoute.tripId,
      'OccurrenceCreated',
      { text: clean, descricao: clean, position: s.position, canal: 'mensagem' },
      'driver',
    );
    set((curr) => ({
      timeline: appendTimeline(
        curr.timeline,
        i18n.t('trip.timeline.occurrenceReported', { text: clean }),
        'brand',
        curr.simMinutes,
      ),
    }));
  },

  quickUnload: () => {
    const s = get();
    const tripId = s.activeRoute.tripId;
    const rotaId = useApiConfig.getState().rotaId;
    if (useApiConfig.getState().mode === 'http') {
      void getApiClient().confirmUnload(rotaId, 'motorista').catch(() => undefined);
    }
    const unloadedAtMin = s.simMinutes;
    const waitedMin = s.arrivedAtMin === null ? 0 : Math.max(0, unloadedAtMin - s.arrivedAtMin);
    const stay = computeStay(waitedMin);
    enqueue(tripId, 'UnloadConfirmed', { ...stay }, 'driver');
    set((curr) => ({
      phase: 'unloaded',
      unloadedAtMin,
      etaMin: 0,
      speedKmh: 0,
      backendStay: curr.backendStay ? { ...curr.backendStay, encerrada: true } : null,
      timeline: appendTimeline(
        curr.timeline,
        i18n.t('trip.timeline.unloadCompleted'),
        'ok',
        curr.simMinutes,
      ),
    }));
    agentBus.emit('agent:context', { context: 'free' });
    agentBus.emit('agent:say', { text: i18n.t('voice.agent.done.unload') });
  },

  start: () => {
    const { ccoWillRespond, activeRoute } = get();
    currentRunId += 1;
    agentBus.emit('voice:reset', {});
    const totalKm = distanceKm(activeRoute.origin.position, activeRoute.destination.position);
    const initialEta = Math.max(1, Math.round((totalKm / SPEED_KMH) * 60));
    set({
      ...initial,
      activeRoute,
      position: activeRoute.origin.position,
      ccoWillRespond,
      phase: 'pickup',
      etaMin: initialEta,
      speedKmh: 0,
      timeline: appendTimeline(
        [],
        i18n.t('trip.timeline.routeAssigned', {
          origin: activeRoute.origin.name,
          destination: activeRoute.destination.name,
        }),
        'brand',
        0,
      ),
    });
    enqueue(
      activeRoute.tripId,
      'RouteAssigned',
      { plate: activeRoute.plate, destination: activeRoute.destination.name },
      'system',
    );
    agentBus.emit('agent:context', { context: 'pickup' });
    agentBus.emit('agent:say', { text: i18n.t('trip.voice.originPrompt') });
  },

  tick: (dtRealMs) => {
    // Em modo conectado, posição, ETA e fase são a fonte de verdade do GPS/API.
    // O simulador local não pode sobrescrever atualizações que chegam do WebSocket.
    if (useApiConfig.getState().mode === 'http') return;

    const s = get();
    if (s.phase === 'idle' || s.phase === 'unloaded') return;

    const route = s.activeRoute;
    const totalKm = pathLengthKm(route.path);
    const tripId = route.tripId;
    const dMin = (dtRealMs / 1000) * (TIME_SCALE / 60);
    const simMinutes = s.simMinutes + dMin;

    if (s.phase === 'driving' || s.phase === 'approaching') {
      const progress = Math.min(1, s.progress + ((SPEED_KMH / 60) * dMin) / (totalKm || 1));
      const position = pointAt(route.path, progress);
      const leftKm = distanceKm(position, route.destination.position);
      const reachedDestination = leftKm * 1000 <= BUSINESS.geofenceMeters || progress >= 1;
      const etaMin = reachedDestination ? 0 : Math.max(1, Math.round((leftKm / SPEED_KMH) * 60));
      const speedKmh = reachedDestination ? 0 : SPEED_KMH;
      set({ simMinutes, progress, position, etaMin, speedKmh });

      if (s.phase === 'driving' && leftKm <= BUSINESS.approachKm) {
        const myRunId = currentRunId;
        set((curr) => ({
          phase: 'approaching',
          receiver: { kind: 'calling' },
          timeline: appendTimeline(
            appendTimeline(
              curr.timeline,
              i18n.t('trip.timeline.approachDetected', { km: Math.round(leftKm) }),
              'brand',
              simMinutes,
            ),
            i18n.t('trip.timeline.receiverCalling'),
            'wait',
            simMinutes,
          ),
        }));
        enqueue(
          tripId,
          'ApproachDetected',
          { leftKm: Math.round(leftKm), lat: position.lat, lng: position.lng },
          'system',
        );
        enqueue(
          tripId,
          'ReceiverNotified',
          { channel: 'ligação', plate: route.plate, eta: '15 min' },
          'agent',
        );

        getApiClient()
          .callReceiver({
            tripId,
            rotaId: useApiConfig.getState().rotaId,
            attempt: 'approach',
            plate: route.plate,
            receiverName: route.destination.receiverName,
            receiverPhone: route.destination.receiverPhone,
            eta: '15 min',
          })
          .catch((): ReceiverAnswer => ({ kind: 'no_answer' }))
          .then((a) => {
            if (myRunId !== currentRunId) return;
            set((curr) => ({
              receiver: a,
              timeline:
                a.kind === 'confirmed'
                  ? appendTimeline(
                      curr.timeline,
                      i18n.t('trip.timeline.receiverConfirmed', { dock: a.dock, time: a.time }),
                      'ok',
                      curr.simMinutes,
                    )
                  : a.kind === 'not_today'
                    ? appendTimeline(
                        curr.timeline,
                        i18n.t('trip.timeline.receiverNotToday'),
                        'alert',
                        curr.simMinutes,
                      )
                    : a.kind === 'no_answer'
                      ? appendTimeline(
                          curr.timeline,
                          i18n.t('trip.timeline.receiverNoAnswer'),
                          'alert',
                          curr.simMinutes,
                        )
                      : curr.timeline,
            }));
            if (a.kind === 'calling') return;
            if (a.kind === 'confirmed') {
              useHeadsUpBanner.getState().show({
                title: i18n.t('headsUp.receiverConfirmedTitle'),
                message: i18n.t('trip.voice.receiverConfirmed', { dock: a.dock, time: a.time }),
                tone: 'ok',
              });
            }
            enqueue(tripId, 'ReceiverCallResult', { moment: 'approach', ...a }, 'agent');
            if (get().phase === 'approaching') {
              agentBus.emit('agent:say', { text: receiverMessage(a) });
            }
          });
      }

      if (reachedDestination) {
        set((curr) => ({
          phase: 'arrived',
          etaMin: 0,
          speedKmh: 0,
          timeline: appendTimeline(
            curr.timeline,
            i18n.t('trip.timeline.geofenceEntered'),
            'brand',
            simMinutes,
          ),
        }));
        agentBus.emit('agent:context', { context: 'checkin' });
        agentBus.emit('agent:say', { text: i18n.t('trip.voice.arrivedPrompt') });
      }
      return;
    }

    if (s.phase === 'waiting' && s.arrivedAtMin !== null) {
      set({ simMinutes, speedKmh: 0, etaMin: 0 });
      // Em modo http, o escalonamento e a estadia vêm do servidor via WebSocket (/ws)
      if (useApiConfig.getState().mode === 'http') {
        return;
      }

      const waited = simMinutes - s.arrivedAtMin;
      const due = Math.floor(waited / BUSINESS.ccoAttemptIntervalMin);

      let attempts = s.ccoAttempts;
      let acknowledged = s.ccoAcknowledged;

      while (!acknowledged && due > attempts && attempts < BUSINESS.maxCcoAttempts) {
        attempts += 1;
        const ch = channelFor(attempts);
        set((curr) => ({
          ccoAttempts: attempts,
          timeline: appendTimeline(
            curr.timeline,
            i18n.t('trip.timeline.ccoEscalated', {
              n: attempts,
              max: BUSINESS.maxCcoAttempts,
              channel: ch,
            }),
            'wait',
            simMinutes,
          ),
        }));
        enqueue(tripId, 'TaskEscalated', { attempt: attempts, channel: ch }, 'system');
        if (s.ccoWillRespond && attempts === 2) {
          acknowledged = true;
          set((curr) => ({
            ccoAcknowledged: true,
            timeline: appendTimeline(
              curr.timeline,
              i18n.t('trip.timeline.ccoAcknowledged'),
              'ok',
              simMinutes,
            ),
          }));
          enqueue(tripId, 'TaskAcknowledged', { by: i18n.t('trip.ccoOperatorMock') }, 'cco');
          agentBus.emit('agent:say', { text: i18n.t('trip.voice.ccoAcknowledged') });
        }
      }

      const after = get();
      if (shouldCallReceiver(after.ccoAttempts, after.ccoAcknowledged) && !after.escalationCallDone) {
        const myRunId = currentRunId;
        set((curr) => ({
          escalationCallDone: true,
          receiver: { kind: 'calling' },
          timeline: appendTimeline(
            curr.timeline,
            i18n.t('trip.timeline.escalationCallingReceiver'),
            'wait',
            simMinutes,
          ),
        }));
        agentBus.emit('agent:say', {
          text: i18n.t('trip.voice.ccoNoResponseCallingReceiver', { max: BUSINESS.maxCcoAttempts }),
        });
        getApiClient()
          .callReceiver({
            tripId,
            rotaId: useApiConfig.getState().rotaId,
            attempt: 'escalation',
            plate: route.plate,
            receiverName: route.destination.receiverName,
            receiverPhone: route.destination.receiverPhone,
          })
          .catch((): ReceiverAnswer => ({ kind: 'no_answer' }))
          .then((a) => {
            if (myRunId !== currentRunId) return;
            set((curr) => ({
              receiver: a,
              timeline:
                a.kind === 'confirmed'
                  ? appendTimeline(
                      curr.timeline,
                      i18n.t('trip.timeline.receiverConfirmed', { dock: a.dock, time: a.time }),
                      'ok',
                      curr.simMinutes,
                    )
                  : a.kind === 'no_answer'
                    ? appendTimeline(
                        curr.timeline,
                        i18n.t('trip.timeline.receiverNoAnswer'),
                        'alert',
                        curr.simMinutes,
                      )
                    : curr.timeline,
            }));
            if (a.kind === 'calling') return;
            if (a.kind === 'confirmed') {
              useHeadsUpBanner.getState().show({
                title: i18n.t('headsUp.receiverConfirmedTitle'),
                message: i18n.t('trip.voice.receiverConfirmed', { dock: a.dock, time: a.time }),
                tone: 'ok',
              });
            }
            enqueue(tripId, 'ReceiverCallResult', { moment: 'escalation', ...a }, 'agent');
            if (get().phase === 'waiting') {
              agentBus.emit('agent:say', { text: receiverMessage(a) });
            }
          });
      }
      return;
    }

    set({ simMinutes });
  },

  setCcoWillRespond: (v) => set({ ccoWillRespond: v }),

  skip: (minutes) => get().tick((minutes * 60 * 1000) / TIME_SCALE),

  jumpToApproach: () => {
    const s = get();
    if (s.phase !== 'driving') return;
    const totalKm = pathLengthKm(s.activeRoute.path) || 1;
    const targetProgress = Math.max(
      s.progress,
      findProgressForRemainingKm(s.activeRoute, BUSINESS.approachKm),
    );
    const deltaProgress = Math.max(0.001, targetProgress - s.progress);
    const neededMinutes = (deltaProgress * totalKm) / (SPEED_KMH / 60);
    get().tick((neededMinutes * 60 * 1000) / TIME_SCALE);
  },

  jumpToArrival: () => {
    const s = get();
    if (s.phase !== 'driving' && s.phase !== 'approaching') return;
    const totalKm = pathLengthKm(s.activeRoute.path) || 1;
    const deltaProgress = Math.max(0.001, 1 - s.progress);
    const neededMinutes = (deltaProgress * totalKm) / (SPEED_KMH / 60);
    get().tick((neededMinutes * 60 * 1000) / TIME_SCALE);
    if (useApiConfig.getState().mode === 'http') {
      void getApiClient()
        .registerArrival(useApiConfig.getState().rotaId)
        .catch(() => undefined);
    }
  },

  reset: () => {
    const { ccoWillRespond } = get();
    currentRunId += 1;
    if (centralClearTimer) {
      clearTimeout(centralClearTimer);
      centralClearTimer = null;
    }
    set({ ...initial, ccoWillRespond });
    agentBus.emit('voice:reset', {});
  },

  setCentralRequest: (req) => set({ centralRequest: req }),

  setGpsDivergence: (msg) => set({ gpsDivergence: msg }),

  clearRouteAssignedBanner: () => set({ routeAssignedBanner: null }),

  syncRouteFromBackend: async (rotaId?: number) => {
    try {
      const apiCfg = useApiConfig.getState();
      const requestId = ++lastRouteSyncRequest;
      const requestedDriverId = apiCfg.driverId;
      const apiRoute = await getApiClient().getAssignedRoute(
        rotaId !== undefined
          ? { tripId: String(rotaId) }
          : { driverId: apiCfg.driverId ?? undefined },
      );
      if (!apiRoute) return;

      // Não permita que uma resposta antiga (boot, troca de perfil ou rota
      // recém-atribuída) volte a pintar uma rota que já não é a ativa.
      const currentApiCfg = useApiConfig.getState();
      if (
        requestId !== lastRouteSyncRequest ||
        (rotaId !== undefined && currentApiCfg.rotaId !== rotaId) ||
        (rotaId === undefined && currentApiCfg.driverId !== requestedDriverId)
      ) {
        return;
      }

      const s = get();
      const parsedRotaId =
        Number(String(apiRoute.tripId).replace(/^rota-|^trip-/, '')) ||
        rotaId ||
        currentApiCfg.rotaId;

      if (parsedRotaId !== currentApiCfg.rotaId) {
        currentApiCfg.setRotaId(parsedRotaId);
      }

      const originPos: LatLng =
        Number.isFinite(apiRoute.origin?.lat) && Number.isFinite(apiRoute.origin?.lng)
          ? { lat: apiRoute.origin.lat, lng: apiRoute.origin.lng }
          : s.activeRoute.origin.position;
      const destPos: LatLng =
        Number.isFinite(apiRoute.destination?.lat) && Number.isFinite(apiRoute.destination?.lng)
          ? { lat: apiRoute.destination.lat, lng: apiRoute.destination.lng }
          : s.activeRoute.destination.position;
      const parsedPolyline = Array.isArray(apiRoute.polyline)
        ? apiRoute.polyline.map(normalizePolylinePoint).filter((p): p is LatLng => p !== null)
        : [];
      const path: LatLng[] = parsedPolyline.length >= 2 ? parsedPolyline : [originPos, destPos];
      const receiverLabel =
        apiRoute.receiver?.company && apiRoute.receiver?.name
          ? `${apiRoute.receiver.company} · ${apiRoute.receiver.name}`
          : apiRoute.receiver?.name || apiRoute.receiver?.company || apiRoute.destination.name;

      const nextRoute: RouteMock = {
        tripId: `rota-${parsedRotaId}`,
        rotaId: parsedRotaId,
        plate: apiRoute.plate || s.activeRoute.plate,
        invoice: apiRoute.invoice,
        cargo: apiRoute.cargo,
        weightT: apiRoute.weightT,
        unloadWindow: apiRoute.unloadWindow,
        company: apiRoute.company,
        driverName: apiRoute.driver?.name,
        origin: {
          id: `o-${parsedRotaId}`,
          name: apiRoute.origin.name,
          position: originPos,
        },
        destination: {
          id: `d-${parsedRotaId}`,
          name: apiRoute.destination.name,
          position: destPos,
          receiverName: receiverLabel,
          receiverPhone: apiRoute.receiver?.phone || s.activeRoute.destination.receiverPhone,
        },
        receiver: {
          name: receiverLabel,
          phone: apiRoute.receiver?.phone || s.activeRoute.receiver.phone,
          company: apiRoute.receiver?.company,
        },
        path,
      };

      const apiPosition = apiRoute.position;
      // O /api/route pode ainda não ter GPS, enquanto o snapshot do WebSocket
      // já trouxe ultima_lat/ultima_lng. Preserve essa posição mais nova.
      const position: LatLng =
        apiPosition &&
        isFiniteNumber(apiPosition.lat) &&
        isFiniteNumber(apiPosition.lng)
        ? { lat: apiPosition.lat, lng: apiPosition.lng }
        : s.activeRoute.rotaId === parsedRotaId
          ? s.position
          : originPos;
      const progress = computeProgressFromPosition(position, nextRoute);
      const phase = statusRotaToPhase(apiRoute.status, s.phase);
      const etaMin =
        typeof apiRoute.position?.etaMin === 'number'
          ? apiRoute.position.etaMin
          : s.etaMin;

      set({
        activeRoute: nextRoute,
        position,
        progress,
        phase,
        etaMin,
      });
      void useDocuments.getState().syncFromBackend(String(parsedRotaId));
    } catch {
      // Ignora erro de sincronização silenciosamente para manter resiliência offline-first
    }
  },

  applyBackendSnapshot: (snap) => {
    const s = get();
    const apiConfig = useApiConfig.getState();
    const configuredRotaId = apiConfig.rotaId;
    const configuredRoute = snap.rotas.find((r) => r.id === configuredRotaId);
    // O stream do motorista contém somente a rota atual. Quando uma nova rota
    // chega antes do evento de atribuição, adotamos apenas esse snapshot único;
    // nunca a primeira rota de uma lista ampla do CCO.
    const rota =
      configuredRoute ??
      (snap.rotas.length === 1 ? snap.rotas[0] : null);
    const routeId = rota?.id ?? configuredRotaId;
    const estadiasDaRota = snap.estadias.filter((e) => e.rota_id === routeId);
    const tasksDaRota = snap.tasks.filter((t) => t.rota_id === routeId);
    const ligacoesDaRota = snap.ligacoes.filter((l) => l.rota_id === routeId);
    const estadia = estadiasDaRota.find((e) => !e.encerrada) ?? estadiasDaRota[0] ?? null;
    const task = tasksDaRota[0] ?? null;
    const ligacao = ligacoesDaRota[0] ?? null;

    let position = s.position;
    let progress = s.progress;
    let phase = s.phase;
    let activeRoute = s.activeRoute;

    if (rota) {
      if (rota.id !== configuredRotaId) {
        apiConfig.setRotaId(rota.id);
      }
      const destPos: LatLng = {
        lat: Number.isFinite(rota.destino_lat) ? rota.destino_lat : s.activeRoute.destination.position.lat,
        lng: Number.isFinite(rota.destino_lng) ? rota.destino_lng : s.activeRoute.destination.position.lng,
      };
      const receiverLabel =
        rota.recebedor_empresa && rota.recebedor_nome
          ? `${rota.recebedor_empresa} · ${rota.recebedor_nome}`
          : rota.recebedor_nome || rota.recebedor_empresa || rota.destino_nome;

      activeRoute = {
        ...s.activeRoute,
        tripId: `rota-${rota.id}`,
        rotaId: rota.id,
        plate: rota.placa || s.activeRoute.plate,
        invoice: rota.nota_fiscal,
        cargo: rota.carga_descricao,
        weightT: rota.carga_t,
        driverName: rota.motorista_nome,
        origin: {
          ...s.activeRoute.origin,
          name: rota.origem_nome || s.activeRoute.origin.name,
        },
        destination: {
          ...s.activeRoute.destination,
          name: rota.destino_nome || s.activeRoute.destination.name,
          position: destPos,
          receiverName: receiverLabel,
        },
        receiver: {
          ...s.activeRoute.receiver,
          name: receiverLabel,
          company: rota.recebedor_empresa,
        },
      };

      if (isFiniteNumber(rota.ultima_lat) && isFiniteNumber(rota.ultima_lng)) {
        position = { lat: rota.ultima_lat, lng: rota.ultima_lng };
        progress = computeProgressFromPosition(position, activeRoute);
      }
      phase = statusRotaToPhase(rota.status, s.phase);

      if (useApiConfig.getState().mode === 'http') {
        void get().syncRouteFromBackend(rota.id);
        void getApiClient()
          .getCentralRequests(rota.id)
          .then((reqs) => {
            const pending = reqs.find((r) => r.status === 'pendente');
            if (pending) {
              set({
                centralRequest: {
                  pergunta: pending.pergunta,
                  resposta: pending.resposta ?? undefined,
                  status: 'pendente',
                },
              });
            }
          })
          .catch(() => undefined);
      }
    }

    const mappedReceiver = ligacaoToReceiverStatus(ligacao, task);
    const arrivedAtMin =
      phase === 'waiting' || phase === 'unloaded' || estadia !== null
        ? (s.arrivedAtMin ?? s.simMinutes)
        : s.arrivedAtMin;
    const unloadedAtMin =
      phase === 'unloaded' || estadia?.encerrada
        ? (s.unloadedAtMin ?? s.simMinutes)
        : s.unloadedAtMin;

    set({
      activeRoute,
      phase,
      position,
      progress,
      arrivedAtMin,
      unloadedAtMin,
      backendStay: estadia,
      backendTask: task,
      backendLigacao: ligacao,
      etaMin: typeof rota?.eta_min === 'number' ? rota.eta_min : s.etaMin,
      speedKmh: phase === 'driving' || phase === 'approaching' ? SPEED_KMH : 0,
      ccoAttempts: task ? task.tentativas : s.ccoAttempts,
      ccoAcknowledged: task ? task.status === 'confirmada' || Boolean(task.confirmado_em) : s.ccoAcknowledged,
      receiver: mappedReceiver ?? s.receiver,
    });
  },

  applyBackendPosicao: (pos) => {
    if (
      pos.rota_id !== useApiConfig.getState().rotaId ||
      !isFiniteNumber(pos.lat) ||
      !isFiniteNumber(pos.lng)
    ) {
      return;
    }
    const s = get();
    const position = { lat: pos.lat, lng: pos.lng };
    const progress = computeProgressFromPosition(position, s.activeRoute);
    const phase = statusRotaToPhase(pos.status, s.phase);
    const etaMin = typeof pos.eta_min === 'number' ? pos.eta_min : s.etaMin;
    const speedKmh = phase === 'driving' || phase === 'approaching' ? SPEED_KMH : 0;
    set({
      position,
      progress,
      phase,
      etaMin,
      speedKmh,
      arrivedAtMin:
        phase === 'waiting' || phase === 'unloaded' ? (s.arrivedAtMin ?? s.simMinutes) : s.arrivedAtMin,
      unloadedAtMin: phase === 'unloaded' ? (s.unloadedAtMin ?? s.simMinutes) : s.unloadedAtMin,
    });
  },

  applyBackendContador: (estadias) => {
    const s = get();
    const estadiasDaRota = estadias.filter((e) => e.rota_id === useApiConfig.getState().rotaId);
    const estadia = estadiasDaRota.find((e) => !e.encerrada) ?? estadiasDaRota[0] ?? null;
    if (!estadia) return;
    const nextPhase = estadia.encerrada
      ? 'unloaded'
      : s.phase === 'idle' || s.phase === 'pickup' || s.phase === 'driving' || s.phase === 'approaching' || s.phase === 'arrived'
        ? 'waiting'
        : s.phase;
    set({
      backendStay: estadia,
      phase: nextPhase,
      arrivedAtMin: s.arrivedAtMin ?? s.simMinutes,
    });
  },

  applyBackendTask: (task) => {
    if (task.rota_id !== useApiConfig.getState().rotaId) return;
    const s = get();
    const mappedReceiver = ligacaoToReceiverStatus(s.backendLigacao, task);
    set({
      backendTask: task,
      ccoAttempts: task.tentativas,
      ccoAcknowledged: task.status === 'confirmada' || Boolean(task.confirmado_em),
      receiver: mappedReceiver ?? s.receiver,
    });
  },

  applyBackendEvento: (evento) => {
    const s = get();
    const ts = evento.timestamp;

    if (evento.tipo === 'rota_atribuida') {
      const nextRotaId =
        evento.rota_id ??
        (typeof evento.dados?.rota_id === 'number' ? evento.dados.rota_id : undefined);
      if (nextRotaId) {
        useApiConfig.getState().setRotaId(nextRotaId);
      }
      const msg = evento.mensagem || i18n.t('trip.routeAssignedBanner.defaultMessage');
      set((curr) => ({
        routeAssignedBanner: msg,
        timeline: appendTimeline(curr.timeline, msg, 'brand', curr.simMinutes, ts),
      }));
      useHeadsUpBanner.getState().show({
        title: i18n.t('trip.routeAssignedBanner.title'),
        message: msg,
        tone: 'brand',
      });
      void get().syncRouteFromBackend(nextRotaId);
      return;
    }

    if (evento.rota_id !== null && evento.rota_id !== useApiConfig.getState().rotaId) {
      return;
    }

    if (evento.tipo === 'rota_publicada') {
      if (evento.rota_id && evento.rota_id === useApiConfig.getState().rotaId) {
        void get().syncRouteFromBackend(evento.rota_id);
      }
      return;
    }

    if (evento.tipo === 'retirada_detectada') {
      set((curr) => ({
        phase: 'pickup',
        timeline: appendTimeline(
          curr.timeline,
          evento.mensagem || i18n.t('trip.timeline.pickupDetected'),
          'brand',
          curr.simMinutes,
          ts,
        ),
      }));
      return;
    }

    if (evento.tipo === 'retirada') {
      set((curr) => ({
        phase: 'driving',
        speedKmh: SPEED_KMH,
        timeline: appendTimeline(
          curr.timeline,
          evento.mensagem || i18n.t('trip.timeline.pickupConfirmed'),
          'ok',
          curr.simMinutes,
          ts,
        ),
      }));
      return;
    }

    if (evento.tipo === 'aproximacao') {
      set((curr) => ({
        phase:
          curr.phase === 'idle' || curr.phase === 'pickup' || curr.phase === 'driving'
            ? 'approaching'
            : curr.phase,
        timeline: appendTimeline(
          curr.timeline,
          evento.mensagem || i18n.t('trip.timeline.approachDetected', { km: BUSINESS.approachKm }),
          'brand',
          curr.simMinutes,
          ts,
        ),
      }));
      return;
    }

    if (evento.tipo === 'ligacao_recebedor' || evento.tipo === 'aviso_recebedor') {
      set((curr) => ({
        receiver: { kind: 'calling' },
        timeline: appendTimeline(
          curr.timeline,
          evento.mensagem || i18n.t('trip.timeline.receiverCalling'),
          'wait',
          curr.simMinutes,
          ts,
        ),
      }));
      return;
    }

    if (
      evento.tipo === 'ligacao_nao_atendida' ||
      evento.tipo === 'ligacao_falhou' ||
      evento.tipo === 'fallback_plano_b'
    ) {
      set((curr) => ({
        receiver: { kind: 'no_answer' },
        timeline: appendTimeline(
          curr.timeline,
          evento.mensagem || i18n.t('trip.timeline.receiverNoAnswer'),
          'alert',
          curr.simMinutes,
          ts,
        ),
      }));
      return;
    }

    if (evento.tipo === 'nao_recebe_hoje') {
      set((curr) => ({
        receiver: { kind: 'not_today' },
        timeline: appendTimeline(
          curr.timeline,
          evento.mensagem || i18n.t('trip.timeline.receiverNotToday'),
          'alert',
          curr.simMinutes,
          ts,
        ),
      }));
      useHeadsUpBanner.getState().show({
        title: i18n.t('headsUp.receiverAlertTitle'),
        message: evento.mensagem || i18n.t('trip.voice.receiverNotToday'),
        tone: 'alert',
      });
      return;
    }

    if (evento.tipo === 'resposta_recebedor') {
      const d = evento.dados as {
        ligacao_id?: number;
        previsao?: string;
        doca?: string;
        motivo?: string;
        recebe_hoje?: boolean;
      };
      if (d?.recebe_hoje === false) {
        set((curr) => ({
          receiver: { kind: 'not_today' },
          timeline: appendTimeline(
            curr.timeline,
            evento.mensagem || i18n.t('trip.timeline.receiverNotToday'),
            'alert',
            curr.simMinutes,
            ts,
          ),
        }));
        useHeadsUpBanner.getState().show({
          title: i18n.t('headsUp.receiverAlertTitle'),
          message: evento.mensagem || i18n.t('trip.voice.receiverNotToday'),
          tone: 'alert',
        });
        return;
      }
      const dock = d.doca || '1';
      const time = d.previsao || evento.mensagem || 'confirmado';
      const nextLigacao: Ligacao = {
        ...(s.backendLigacao ?? {
          id: d.ligacao_id ?? 0,
          rota_id: evento.rota_id ?? useApiConfig.getState().rotaId,
          task_id: s.backendTask?.id ?? null,
          motivo: 'cco_sem_resposta',
          modo: 'rtc',
          numero: s.activeRoute.receiver.phone,
          canal: null,
          transcricao: [],
        }),
        id: d.ligacao_id ?? s.backendLigacao?.id ?? 0,
        status: 'respondida',
        atendida: true,
        previsao: d.previsao ?? null,
        doca: d.doca ?? null,
        motivo_espera: d.motivo ?? null,
        resposta_resumo: evento.mensagem,
      };
      const label =
        evento.mensagem || i18n.t('trip.timeline.receiverConfirmed', { dock, time });
      set((curr) => ({
        backendLigacao: nextLigacao,
        receiver: {
          kind: 'confirmed',
          dock,
          time,
        },
        timeline: appendTimeline(curr.timeline, label, 'ok', curr.simMinutes, ts),
      }));
      useHeadsUpBanner.getState().show({
        title: i18n.t('headsUp.receiverConfirmedTitle'),
        message: label,
        tone: 'ok',
      });
      return;
    }

    if (evento.tipo === 'pedido_central') {
      if (centralClearTimer) {
        clearTimeout(centralClearTimer);
        centralClearTimer = null;
      }
      const pergunta =
        (typeof evento.dados?.pergunta === 'string' && evento.dados.pergunta) ||
        evento.mensagem;
      set((curr) => ({
        centralRequest: {
          pergunta,
          status: 'pendente',
        },
        timeline: appendTimeline(
          curr.timeline,
          i18n.t('trip.timeline.centralQuestion', { question: pergunta }),
          'wait',
          curr.simMinutes,
          ts,
        ),
      }));
      useHeadsUpBanner.getState().show({
        title: i18n.t('trip.centralRequest.title'),
        message: pergunta,
        tone: 'wait',
      });
      return;
    }

    if (evento.tipo === 'resposta_central') {
      const resposta =
        (typeof evento.dados?.resposta === 'string' && evento.dados.resposta) ||
        evento.mensagem;
      set((curr) => ({
        centralRequest: curr.centralRequest
          ? { ...curr.centralRequest, resposta, status: 'respondida' }
          : { pergunta: '', resposta, status: 'respondida' },
        timeline: appendTimeline(
          curr.timeline,
          i18n.t('trip.timeline.centralAnswered', { answer: resposta }),
          'ok',
          curr.simMinutes,
          ts,
        ),
      }));
      if (centralClearTimer) {
        clearTimeout(centralClearTimer);
      }
      centralClearTimer = setTimeout(() => {
        if (get().centralRequest?.status === 'respondida') {
          set({ centralRequest: null });
        }
        centralClearTimer = null;
      }, 5000);
      return;
    }

    if (evento.tipo === 'divergencia_gps') {
      set((curr) => ({
        gpsDivergence: evento.mensagem,
        timeline: appendTimeline(
          curr.timeline,
          evento.mensagem || i18n.t('trip.gpsDivergence.title'),
          'alert',
          curr.simMinutes,
          ts,
        ),
      }));
      useHeadsUpBanner.getState().show({
        title: i18n.t('trip.gpsDivergence.title'),
        message: evento.mensagem,
        tone: 'alert',
      });
      return;
    }

    if (evento.tipo === 'pergunta_documento') {
      const label =
        evento.mensagem ||
        i18n.t('trip.timeline.documentQueried', {
          doc: String((evento.dados as { documento?: string })?.documento || 'NF-e'),
        });
      set((curr) => ({
        timeline: appendTimeline(curr.timeline, label, 'brand', curr.simMinutes, ts),
      }));
      return;
    }

    if (evento.tipo === 'ocorrencia') {
      set((curr) => ({
        timeline: appendTimeline(
          curr.timeline,
          evento.mensagem || i18n.t('events.OccurrenceCreated'),
          'wait',
          curr.simMinutes,
          ts,
        ),
      }));
      return;
    }

    if (
      evento.tipo === 'notificacao_cco'
      || evento.tipo === 'escalada_recebedor'
      || evento.tipo === 'chamado_cco_aberto'
      || evento.tipo === 'chamado_cco_lembrete'
      || evento.tipo === 'chamado_cco_respondido'
      || evento.tipo === 'chamado_cco_timeout'
    ) {
      set((curr) => ({
        timeline: appendTimeline(
          curr.timeline,
          evento.mensagem || i18n.t('events.TaskEscalated'),
          'wait',
          curr.simMinutes,
          ts,
        ),
      }));
      return;
    }

    if (evento.tipo === 'task_criada') {
      set((curr) => ({
        phase: curr.phase === 'arrived' ? 'waiting' : curr.phase,
        arrivedAtMin:
          curr.phase === 'arrived' ? (curr.arrivedAtMin ?? curr.simMinutes) : curr.arrivedAtMin,
        timeline: appendTimeline(
          curr.timeline,
          evento.mensagem || i18n.t('trip.timeline.ccoTaskCreated'),
          'brand',
          curr.simMinutes,
          ts,
        ),
      }));
      return;
    }

    if (evento.tipo === 'campo_faltante' || evento.tipo === 'relatorio') {
      return;
    }

    if (evento.tipo === 'task_confirmada') {
      set((curr) => ({
        ccoAcknowledged: true,
        timeline: appendTimeline(
          curr.timeline,
          evento.mensagem || i18n.t('trip.timeline.ccoAcknowledged'),
          'ok',
          curr.simMinutes,
          ts,
        ),
      }));
      return;
    }

    if (evento.tipo === 'chegada' || evento.tipo === 'chegada_confirmada_voz') {
      set((curr) => ({
        phase: 'waiting',
        etaMin: 0,
        speedKmh: 0,
        arrivedAtMin: curr.arrivedAtMin ?? curr.simMinutes,
        timeline: appendTimeline(
          curr.timeline,
          evento.mensagem || i18n.t('trip.timeline.arrivalConfirmed'),
          'ok',
          curr.simMinutes,
          ts,
        ),
      }));
      return;
    }

    if (evento.tipo === 'descarga') {
      set((curr) => ({
        phase: 'unloaded',
        etaMin: 0,
        speedKmh: 0,
        unloadedAtMin: curr.unloadedAtMin ?? curr.simMinutes,
        backendStay: curr.backendStay ? { ...curr.backendStay, encerrada: true } : null,
        timeline: appendTimeline(
          curr.timeline,
          evento.mensagem || i18n.t('trip.timeline.unloadCompleted'),
          'ok',
          curr.simMinutes,
          ts,
        ),
      }));
    }
  },

  applyBackendReset: () => {
    const { ccoWillRespond } = get();
    currentRunId += 1;
    if (centralClearTimer) {
      clearTimeout(centralClearTimer);
      centralClearTimer = null;
    }
    set({ ...initial, ccoWillRespond });
    agentBus.emit('voice:reset', {});
  },
}));

/** Reage ao que o agente coletou por voz. Chamar uma vez no bootstrap. */
export function wireTripToVoice() {
  const offDone = agentBus.on('voice:completed', ({ context, fields }) => {
    const s = useTrip.getState();
    const tripId = s.activeRoute.tripId;
    if (context === 'pickup') {
      enqueue(tripId, 'PickupConfirmed', {}, 'driver');
      enqueue(
        tripId,
        'ReportSubmitted',
        { kind: 'inicial', tipo: 'inicial', fields, campos: fields },
        'driver',
      );
      useTrip.setState((curr) => ({
        phase: 'driving',
        speedKmh: SPEED_KMH,
        timeline: appendTimeline(
          curr.timeline,
          i18n.t('trip.timeline.pickupConfirmed'),
          'ok',
          curr.simMinutes,
        ),
      }));
    }
    if (context === 'checkin') {
      enqueue(
        tripId,
        'ArrivalRegistered',
        { fields, simMinutes: Math.round(s.simMinutes) },
        'driver',
      );
      enqueue(tripId, 'TaskCreated', { priority: 'baixa' }, 'system');
      useTrip.setState((curr) => ({
        phase: 'waiting',
        arrivedAtMin: curr.simMinutes,
        etaMin: 0,
        speedKmh: 0,
        timeline: appendTimeline(
          appendTimeline(
            curr.timeline,
            i18n.t('trip.timeline.arrivalConfirmed'),
            'ok',
            curr.simMinutes,
          ),
          i18n.t('trip.timeline.ccoTaskCreated'),
          'brand',
          curr.simMinutes,
        ),
      }));
      agentBus.emit('agent:context', { context: 'unload' });
    }
    if (context === 'unload') {
      const unloadedAtMin = s.simMinutes;
      const waitedMin = s.arrivedAtMin === null ? 0 : Math.max(0, unloadedAtMin - s.arrivedAtMin);
      const stay = computeStay(waitedMin);
      enqueue(tripId, 'UnloadConfirmed', { ...stay }, 'driver');
      useTrip.setState((curr) => ({
        phase: 'unloaded',
        unloadedAtMin,
        etaMin: 0,
        speedKmh: 0,
        timeline: appendTimeline(
          curr.timeline,
          i18n.t('trip.timeline.unloadCompleted'),
          'ok',
          curr.simMinutes,
        ),
      }));
    }
  });

  const offMissing = agentBus.on('voice:field_missing', ({ context, missing, collected, utterance }) => {
    const tripId = useTrip.getState().activeRoute.tripId;
    enqueue(tripId, 'ReportFieldMissing', { context, missing, collected, utterance }, 'agent');
  });

  const offOcc = agentBus.on('voice:occurrence', ({ text, descricao, km, rodovia }) => {
    const s = useTrip.getState();
    enqueue(
      s.activeRoute.tripId,
      'OccurrenceCreated',
      { text, descricao, km, rodovia, position: s.position },
      'driver',
    );
    useTrip.getState().addTimelineEntry(
      i18n.t('trip.timeline.occurrenceReported', { text }),
      'wait',
    );
  });

  const offDoc = agentBus.on('voice:document_answered', ({ question, answer, documentId, field, found }) => {
    const tripId = useTrip.getState().activeRoute.tripId;
    enqueue(
      tripId,
      'DocumentQuestionAnswered',
      { question, answer, documentId, field, found },
      'agent',
    );
    useTrip.getState().addTimelineEntry(
      i18n.t('trip.timeline.documentQueried', { doc: documentId || 'NF-e' }),
      'brand',
    );
  });

  return () => {
    offDone();
    offMissing();
    offOcc();
    offDoc();
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
