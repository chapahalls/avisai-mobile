export type TripPhase = 'idle' | 'pickup' | 'driving' | 'approaching' | 'arrived' | 'waiting' | 'unloaded';

export type ReceiverStatus =
  | { kind: 'pending' }
  | { kind: 'calling' }
  | { kind: 'confirmed'; dock: string; time: string }
  | { kind: 'not_today' }
  | { kind: 'no_answer' };

export type { RouteMock, Stop } from '../../../types/route';

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
