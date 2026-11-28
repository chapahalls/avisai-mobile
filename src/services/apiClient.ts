import type {
  ApiDocumentResponse,
  ApiRouteFile,
  ApiRouteResponse,
  DemoProfile,
  PosicaoOut,
  Rota,
  Sessao,
  Snapshot,
  SolicitacaoCentral,
} from '../types/backend';
import type { DomainEvent } from '../types/events';

export type ReceiverAnswer =
  | { kind: 'confirmed'; dock: string; time: string }
  | { kind: 'calling' }
  | { kind: 'not_today' }
  | { kind: 'no_answer' };

export interface Session {
  token: string;
  name: string;
  company: string;
  email?: string;
  driverId?: number;
  tripId?: string;
  role?: string;
}

export interface CallReceiverParams {
  tripId: string;
  rotaId?: number;
  attempt: 'approach' | 'escalation';
  plate: string;
  receiverName?: string;
  receiverPhone?: string;
  eta?: string;
}

export interface VoiceTokenParams {
  channel: string;
  uid: number;
}

export interface VoiceTokenResponse {
  app_id: string;
  channel: string;
  uid: number;
  token: string;
}

export interface SendPositionBody {
  lat: number;
  lng: number;
  velocidade_kmh?: number;
  precisao_m?: number;
  fonte?: 'celular' | 'rastreador';
}

export interface HealthCheckResult {
  ok: boolean;
  publicUrl?: string;
  agoraConfigured?: boolean;
  llmMode?: string;
  llmUpstream?: boolean;
  receiverMode?: string;
  error?: string;
}

export class NetworkError extends Error {
  /** Status HTTP da resposta, quando o servidor respondeu. */
  readonly status?: number;

  constructor(message = 'network_error', status?: number) {
    super(message);
    this.name = 'NetworkError';
    this.status = status;
  }
}

export interface ApiClient {
  checkHealth(): Promise<HealthCheckResult>;
  createSession(rotaId: number): Promise<Sessao>;
  deleteSession(sessionId: number): Promise<void>;
  getVoiceToken(params: VoiceTokenParams): Promise<VoiceTokenResponse>;
  speak(sessionId: number, texto: string, prioridade?: 'APPEND' | 'INTERRUPT'): Promise<void>;
  getRoute(rotaId: number): Promise<Rota | null>;
  getAssignedRoute(params?: { tripId?: string; driverId?: number }): Promise<ApiRouteResponse | null>;
  getDocuments(tripId?: string): Promise<ApiDocumentResponse[]>;
  getRouteFiles(rotaId: number): Promise<ApiRouteFile[]>;
  getCentralRequests(rotaId?: number): Promise<SolicitacaoCentral[]>;
  sendPosition(rotaId: number, body: SendPositionBody): Promise<PosicaoOut>;
  registerArrival(rotaId: number): Promise<void>;
  confirmUnload(rotaId: number, por?: string): Promise<void>;
  callReceiver(params: CallReceiverParams): Promise<ReceiverAnswer>;
  resetRoute(rotaId: number): Promise<void>;
  getSnapshot(rotaId: number): Promise<Snapshot>;
  postEvent(event: DomainEvent): Promise<{ status: 200 | 409; receivedAt: string }>;
  /** Envia o áudio de uma fala gravada sem sinal (`DriverVoiceNote`). 409 = já recebido. */
  uploadVoiceNote(event: DomainEvent): Promise<{ status: 200 | 409; receivedAt: string }>;
  getEvents(tripId: string): Promise<DomainEvent[]>;
  getDemoProfiles(role?: 'cco' | 'driver'): Promise<DemoProfile[]>;
  ssoLogin(email?: string): Promise<Session>;
}
