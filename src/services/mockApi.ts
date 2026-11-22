import i18n from '../lib/i18n';
import { ROUTE } from '../features/trip/api/route.mock';
import {
  UID,
  type ApiDocumentResponse,
  type ApiRouteFile,
  type ApiRouteResponse,
  type DemoProfile,
  type PosicaoOut,
  type Rota,
  type Sessao,
  type Snapshot,
  type SolicitacaoCentral,
} from '../types/backend';
import type { DomainEvent } from '../types/events';
import type { LatLng } from '../types/geo';
import { useApiConfig } from './api';
import {
  NetworkError,
  type ApiClient,
  type CallReceiverParams,
  type HealthCheckResult,
  type ReceiverAnswer,
  type SendPositionBody,
  type Session,
  type VoiceTokenParams,
  type VoiceTokenResponse,
} from './apiClient';
import { useNetwork } from './network';

export { NetworkError, type ReceiverAnswer };

interface DriverSeedFixture {
  id: string;
  email: string;
  name: string;
  driverId: number;
  rotaId: number;
  tripId: string;
  plate: string;
  invoice: string;
  cargo: string;
  weightT: number;
  unloadWindow: string;
  origin: { name: string; lat: number; lng: number };
  destination: { name: string; lat: number; lng: number };
  receiver: { company: string; name: string; rotaReceiverName: string; phone: string };
  distanceM: number;
  etaMin: number;
  polyline: LatLng[];
}

function buildPolyline(from: LatLng, to: LatLng, count = 10): LatLng[] {
  const steps = Math.max(2, count) - 1;
  return Array.from({ length: steps + 1 }, (_, i) => ({
    lat: Number((from.lat + ((to.lat - from.lat) * i) / steps).toFixed(6)),
    lng: Number((from.lng + ((to.lng - from.lng) * i) / steps).toFixed(6)),
  }));
}

const ORIGIN_JUNDIAI: LatLng = {
  lat: ROUTE.origin.position.lat,
  lng: ROUTE.origin.position.lng,
};

const DRIVER_FIXTURES: DriverSeedFixture[] = [
  {
    id: 'u-driver-1',
    email: 'carlos@rotasul.test',
    name: 'Carlos Andrade',
    driverId: 1,
    rotaId: 1,
    tripId: '1',
    plate: ROUTE.plate,
    invoice: '000.482.913',
    cargo: '28 paletes de bebidas',
    weightT: 28,
    unloadWindow: 'hoje, 14h às 16h',
    origin: {
      name: ROUTE.origin.name,
      lat: ORIGIN_JUNDIAI.lat,
      lng: ORIGIN_JUNDIAI.lng,
    },
    destination: {
      name: ROUTE.destination.name,
      lat: ROUTE.destination.position.lat,
      lng: ROUTE.destination.position.lng,
    },
    receiver: {
      company: 'Mercadão Campinas',
      name: 'Marcos',
      rotaReceiverName: 'Marcos, do recebimento',
      phone: ROUTE.receiver.phone,
    },
    distanceM: 35340,
    etaMin: 35,
    polyline: ROUTE.path,
  },
  {
    id: 'u-driver-2',
    email: 'marina@rotasul.test',
    name: 'Marina Souza',
    driverId: 2,
    rotaId: 2,
    tripId: '2',
    plate: 'DMO-2A02',
    invoice: 'DEMO-AVISAI-002',
    cargo: '18 paletes de limpeza',
    weightT: 18,
    unloadWindow: 'hoje, 15h às 17h',
    origin: {
      name: 'CD Jundiaí',
      lat: ORIGIN_JUNDIAI.lat,
      lng: ORIGIN_JUNDIAI.lng,
    },
    destination: {
      name: 'Recebedor fictício DEMO · Sorocaba',
      lat: -23.5015,
      lng: -47.4526,
    },
    receiver: {
      company: 'Recebedor fictício DEMO · Sorocaba',
      name: 'Portaria DEMO Sorocaba',
      rotaReceiverName: 'Portaria DEMO Sorocaba',
      phone: ROUTE.receiver.phone,
    },
    distanceM: 66800,
    etaMin: 52,
    polyline: buildPolyline(ORIGIN_JUNDIAI, { lat: -23.5015, lng: -47.4526 }, 10),
  },
  {
    id: 'u-driver-3',
    email: 'joao@rotasul.test',
    name: 'João Pereira',
    driverId: 3,
    rotaId: 3,
    tripId: '3',
    plate: 'DMO-3A03',
    invoice: 'DEMO-AVISAI-003',
    cargo: '22 paletes de embalagens',
    weightT: 22,
    unloadWindow: 'hoje, 16h às 18h',
    origin: {
      name: 'CD Jundiaí',
      lat: ORIGIN_JUNDIAI.lat,
      lng: ORIGIN_JUNDIAI.lng,
    },
    destination: {
      name: 'Recebedor fictício DEMO · Sumaré',
      lat: -22.8211,
      lng: -47.267,
    },
    receiver: {
      company: 'Recebedor fictício DEMO · Sumaré',
      name: 'Portaria DEMO Sumaré',
      rotaReceiverName: 'Portaria DEMO Sumaré',
      phone: ROUTE.receiver.phone,
    },
    distanceM: 55400,
    etaMin: 44,
    polyline: buildPolyline(ORIGIN_JUNDIAI, { lat: -22.8211, lng: -47.267 }, 10),
  },
];

function resolveFixtureById(id?: number | string | null): DriverSeedFixture {
  if (id === undefined || id === null) return DRIVER_FIXTURES[0]!;
  const num = Number(String(id).replace(/^rota-|^trip-/, ''));
  if (Number.isFinite(num) && num > 0) {
    const found = DRIVER_FIXTURES.find((f) => f.driverId === num || f.rotaId === num);
    if (found) return found;
  }
  return DRIVER_FIXTURES[0]!;
}

/**
 * Servidor mock dentro do app. Simula latência, falhas e idempotência.
 * Compatível com a interface `ApiClient` para troca transparente com `httpApiClient`.
 */
const received = new Map<string, DomainEvent>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function checkHealth(): Promise<HealthCheckResult> {
  await sleep(100);
  return { ok: true, publicUrl: 'mock://local' };
}

export async function createSession(rotaId = 1): Promise<Sessao> {
  await sleep(150);
  return {
    id: 1,
    rota_id: rotaId,
    papel: 'motorista',
    canal: `avisai-rota-${rotaId}`,
    agent_uid: UID.AGENTE_MOTORISTA,
    user_uid: UID.MOTORISTA,
    agent_id: `mock-agent-${Date.now()}`,
    status: 'ativa',
    llm_mode: 'mock',
    app_id: 'mock-agora-app-id',
    token: 'mock-agora-token',
  };
}

export async function deleteSession(_sessionId: number): Promise<void> {
  await sleep(80);
}

export async function getVoiceToken(params: VoiceTokenParams): Promise<VoiceTokenResponse> {
  await sleep(120);
  return {
    app_id: 'mock-agora-app-id',
    token: 'mock-agora-token',
    channel: params.channel,
    uid: params.uid,
  };
}

export async function speak(
  _sessionId: number,
  _texto: string,
  _prioridade: 'APPEND' | 'INTERRUPT' = 'APPEND',
): Promise<void> {
  await sleep(80);
}

export async function getRoute(rotaId = 1): Promise<Rota | null> {
  await sleep(100);
  const fixture = resolveFixtureById(rotaId);
  return {
    id: rotaId,
    status: 'planejada',
    placa: fixture.plate,
    nota_fiscal: fixture.invoice,
    carga_descricao: fixture.cargo,
    carga_t: fixture.weightT,
    origem_nome: fixture.origin.name,
    destino_nome: fixture.destination.name,
    destino_lat: fixture.destination.lat,
    destino_lng: fixture.destination.lng,
    ultima_lat: fixture.origin.lat,
    ultima_lng: fixture.origin.lng,
    distancia_m: fixture.distanceM,
    eta_min: fixture.etaMin,
    recebedor_empresa: fixture.receiver.company,
    recebedor_nome: fixture.receiver.rotaReceiverName,
    motorista_nome: fixture.name,
    canal_motorista: `avisai-rota-${rotaId}`,
    uid_motorista: UID.MOTORISTA,
    uid_cco: UID.CCO,
    uid_agente: UID.AGENTE_MOTORISTA,
  };
}

export async function getAssignedRoute(params?: {
  tripId?: string;
  driverId?: number;
}): Promise<ApiRouteResponse | null> {
  await sleep(100);
  const rawId =
    params?.tripId !== undefined
      ? params.tripId
      : params?.driverId !== undefined
        ? params.driverId
        : (useApiConfig.getState().driverId ?? useApiConfig.getState().rotaId ?? 1);
  const parsedTripId =
    Number(String(rawId).replace(/^rota-|^trip-/, '')) || (params?.driverId ?? 1);
  const fixture = resolveFixtureById(params?.driverId ?? parsedTripId);
  return {
    tripId: String(parsedTripId),
    status: 'planejada',
    company: 'Transportadora Rota Sul',
    driver: { name: fixture.name },
    plate: fixture.plate,
    invoice: fixture.invoice,
    cargo: fixture.cargo,
    weightT: fixture.weightT,
    unloadWindow: fixture.unloadWindow,
    origin: {
      name: fixture.origin.name,
      lat: fixture.origin.lat,
      lng: fixture.origin.lng,
    },
    destination: {
      name: fixture.destination.name,
      lat: fixture.destination.lat,
      lng: fixture.destination.lng,
    },
    polyline: fixture.polyline,
    receiver: {
      company: fixture.receiver.company,
      name: fixture.receiver.name,
      phone: fixture.receiver.phone,
    },
    driverId: params?.driverId ?? fixture.driverId,
    assignedAt: new Date().toISOString(),
    position: {
      lat: fixture.origin.lat,
      lng: fixture.origin.lng,
      distanceM: fixture.distanceM,
      etaMin: fixture.etaMin,
    },
    channel: `avisai-rota-${parsedTripId}`,
    driverUid: UID.MOTORISTA,
    agentUid: UID.AGENTE_MOTORISTA,
  };
}

export async function getDocuments(tripId?: string): Promise<ApiDocumentResponse[]> {
  await sleep(80);
  const targetId = tripId ?? String(useApiConfig.getState().rotaId || 1);
  const numId = Number(String(targetId).replace(/^rota-|^trip-/, '')) || 1;

  if (numId === 2) {
    return [
      {
        id: 'nfe-DEMO-AVISAI-002',
        kind: 'NF-e',
        title: 'NF-e DEMO-AVISAI-002',
        number: 'DEMO-AVISAI-002',
        issuer: 'Transportadora Rota Sul',
        recipient: 'Recebedor fictício DEMO · Sorocaba',
        weightKg: 18000,
        items: '18 paletes de limpeza',
        valueBRL: 54120,
        campos: {
          numero: 'DEMO-AVISAI-002',
          peso_kg: '18.000 kg (18 t)',
          valor: 'R$ 54.120,00',
          emitente: 'Transportadora Rota Sul',
          destinatario: 'Recebedor fictício DEMO · Sorocaba',
          itens: '18 paletes de limpeza',
          chave: '3526 1100 0000 0000 0255 5500 1000 0000 0210 0000 0022',
        },
        fileUri: null,
        mock: true,
      },
      {
        id: 'cte-DEMO-CTE-002',
        kind: 'CT-e',
        title: 'CT-e DEMO-CTE-002',
        number: 'DEMO-CTE-002',
        carrier: 'Transportadora Rota Sul',
        plate: 'DMO-2A02',
        freightBRL: 2450,
        campos: {
          numero: 'DEMO-CTE-002',
          transportadora: 'Transportadora Rota Sul',
          placa: 'DMO-2A02',
          frete: 'R$ 2.450,00',
          nfe_referenciada: 'DEMO-AVISAI-002',
        },
        fileUri: null,
        mock: true,
      },
    ];
  }

  if (numId === 3) {
    return [
      {
        id: 'nfe-DEMO-AVISAI-003',
        kind: 'NF-e',
        title: 'NF-e DEMO-AVISAI-003',
        number: 'DEMO-AVISAI-003',
        issuer: 'Transportadora Rota Sul',
        recipient: 'Recebedor fictício DEMO · Sumaré',
        weightKg: 22000,
        items: '22 paletes de embalagens',
        valueBRL: 63800,
        campos: {
          numero: 'DEMO-AVISAI-003',
          peso_kg: '22.000 kg (22 t)',
          valor: 'R$ 63.800,00',
          emitente: 'Transportadora Rota Sul',
          destinatario: 'Recebedor fictício DEMO · Sumaré',
          itens: '22 paletes de embalagens',
          chave: '3526 1100 0000 0000 0355 5500 1000 0000 0310 0000 0033',
        },
        fileUri: null,
        mock: true,
      },
      {
        id: 'cte-DEMO-CTE-003',
        kind: 'CT-e',
        title: 'CT-e DEMO-CTE-003',
        number: 'DEMO-CTE-003',
        carrier: 'Transportadora Rota Sul',
        plate: 'DMO-3A03',
        freightBRL: 2790,
        campos: {
          numero: 'DEMO-CTE-003',
          transportadora: 'Transportadora Rota Sul',
          placa: 'DMO-3A03',
          frete: 'R$ 2.790,00',
          nfe_referenciada: 'DEMO-AVISAI-003',
        },
        fileUri: null,
        mock: true,
      },
    ];
  }

  return [
    {
      id: 'nfe-000.482.913',
      kind: 'NF-e',
      title: 'NF-e 000.482.913',
      number: '000.482.913',
      issuer: 'Transportadora Rota Sul',
      recipient: 'Mercadão Campinas',
      weightKg: 28000,
      items: '28 paletes de bebidas',
      valueBRL: 84230.5,
      campos: {
        numero: '000.482.913',
        peso_kg: '28.000 kg (28 t)',
        valor: 'R$ 84.230,50',
        emitente: 'Transportadora Rota Sul',
        destinatario: 'Mercadão Campinas',
        itens: '28 paletes de bebidas',
        chave: '3526 1104 8291 3000 0155 5500 1000 4829 1310 0048 2913',
      },
      fileUri: null,
      mock: true,
    },
    {
      id: 'cte-000.771.204',
      kind: 'CT-e',
      title: 'CT-e 000.771.204',
      number: '000.771.204',
      carrier: 'Transportadora Rota Sul',
      plate: ROUTE.plate,
      freightBRL: 3120,
      campos: {
        numero: '000.771.204',
        transportadora: 'Transportadora Rota Sul',
        placa: ROUTE.plate,
        frete: 'R$ 3.120,00',
        nfe_referenciada: '000.482.913',
      },
      fileUri: null,
      mock: true,
    },
  ];
}

export async function getRouteFiles(_rotaId = 1): Promise<ApiRouteFile[]> {
  await sleep(60);
  return [];
}

export async function getCentralRequests(_rotaId = 1): Promise<SolicitacaoCentral[]> {
  await sleep(60);
  return [];
}

export async function sendPosition(rotaId: number, _body: SendPositionBody): Promise<PosicaoOut> {
  await sleep(100);
  return {
    rota_id: rotaId,
    distancia_m: 1000,
    eta_min: 2,
    status: 'em_transito',
    disparos: [],
  };
}

export async function registerArrival(_rotaId = 1): Promise<void> {
  await sleep(100);
}

export async function confirmUnload(_rotaId = 1, _por = 'motorista'): Promise<void> {
  await sleep(100);
}

export async function resetRoute(_rotaId = 1): Promise<void> {
  await sleep(100);
}

export async function getSnapshot(rotaId = 1): Promise<Snapshot> {
  const r = await getRoute(rotaId);
  return {
    rotas: r ? [r] : [],
    tasks: [],
    estadias: [],
    ligacoes: [],
    ocorrencias: [],
    eventos: [],
  };
}

export async function postEvent(event: DomainEvent): Promise<{ status: 200 | 409; receivedAt: string }> {
  const q = useNetwork.getState().quality();
  if (q === 'offline') throw new NetworkError('offline');
  await sleep(q === 'weak' ? 1500 : 300);
  if (Math.random() < (q === 'weak' ? 0.4 : 0.08)) throw new NetworkError('timeout');
  const existing = received.get(event.idempotencyKey);
  if (existing) {
    return { status: 409, receivedAt: existing.receivedAt ?? new Date().toISOString() };
  }
  const receivedAt = new Date().toISOString();
  received.set(event.idempotencyKey, { ...event, receivedAt });
  return { status: 200, receivedAt };
}

export async function getEvents(tripId: string): Promise<DomainEvent[]> {
  return Array.from(received.values()).filter((e) => e.tripId === tripId);
}

export async function callReceiver(
  paramsOrAttempt: CallReceiverParams | 'approach' | 'escalation',
): Promise<ReceiverAnswer> {
  const attempt = typeof paramsOrAttempt === 'string' ? paramsOrAttempt : paramsOrAttempt.attempt;
  await sleep(2500);
  const r = Math.random();
  if (attempt === 'approach') {
    if (r < 0.7) return { kind: 'confirmed', dock: '4', time: '15:00' };
    if (r < 0.85) return { kind: 'not_today' };
    return { kind: 'no_answer' };
  }
  return r < 0.75
    ? { kind: 'confirmed', dock: '2', time: i18n.t('trip.receiverEscalationEta') }
    : { kind: 'no_answer' };
}

export async function getDemoProfiles(role?: 'cco' | 'driver'): Promise<DemoProfile[]> {
  await sleep(60);
  if (role === 'cco') {
    return [
      {
        id: 'u-cco-1',
        email: 'cco@rotasul.test',
        name: 'Operadora CCO (Demo)',
        role: 'cco',
        driverId: null,
        tripId: null,
      },
    ];
  }
  return DRIVER_FIXTURES.map((f) => ({
    id: f.id,
    email: f.email,
    name: f.name,
    role: 'driver',
    driverId: f.driverId,
    tripId: f.tripId,
  }));
}

/** SSO genérico mock alinhado ao seed (Carlos Andrade / Marina Souza / João Pereira). */
export async function ssoLogin(email?: string): Promise<Session> {
  await sleep(120);
  const normalized = email?.trim().toLowerCase();
  const fixture =
    DRIVER_FIXTURES.find((f) => f.email.toLowerCase() === normalized) ?? DRIVER_FIXTURES[0]!;
  useApiConfig.getState().setDriverId(fixture.driverId);
  useApiConfig.getState().setRotaId(fixture.rotaId);
  return {
    token: 'mock-token',
    name: fixture.name,
    company: 'Transportadora Rota Sul',
    email: fixture.email,
    driverId: fixture.driverId,
    tripId: fixture.tripId,
    role: 'driver',
  };
}

export const mockApiClient: ApiClient = {
  checkHealth,
  createSession,
  deleteSession,
  getVoiceToken,
  speak,
  getRoute,
  getAssignedRoute,
  getDocuments,
  getRouteFiles,
  getCentralRequests,
  sendPosition,
  registerArrival,
  confirmUnload,
  callReceiver,
  resetRoute,
  getSnapshot,
  postEvent,
  getEvents,
  getDemoProfiles,
  ssoLogin,
};
