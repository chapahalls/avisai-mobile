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
  plate: string;
  origin: Stop;
  destination: Stop;
  path: LatLng[];
}
