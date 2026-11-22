import type { LatLng } from '../../../types/geo';

export type TripPhase = 'idle' | 'pickup' | 'driving' | 'approaching' | 'arrived' | 'waiting' | 'unloaded';

export type ReceiverStatus =
  | { kind: 'pending' }
  | { kind: 'calling' }
  | { kind: 'confirmed'; dock: string; time: string }
  | { kind: 'not_today' }
  | { kind: 'no_answer' };

export interface Stop {
  id: string;
  name: string;
  position: LatLng;
  receiverName?: string;
  /** Telefone do responsável pelo recebimento. Mock: nunca colocar número real no repositório (E7). */
  receiverPhone?: string;
}

export interface RouteMock {
  tripId: string;
  rotaId: number;
  plate: string;
  invoice?: string;
  cargo?: string;
  weightT?: number;
  unloadWindow?: string | null;
  company?: string;
  driverName?: string | null;
  origin: Stop;
  destination: Stop;
  receiver: {
    name: string;
    phone: string;
    company?: string;
  };
  path: LatLng[];
}

export interface CentralRequestState {
  pergunta: string;
  resposta?: string;
  status: 'pendente' | 'respondida';
}

export type TimelineTone = 'brand' | 'ok' | 'wait' | 'alert';

export interface TimelineEntry {
  id: string;
  time: string;
  label: string;
  tone: TimelineTone;
}
