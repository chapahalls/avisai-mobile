/** Contrato de eventos. Igual ao do repositório web (avisai-web/src/types/events.ts). */
export type EventType =
  | 'RouteAssigned'
  | 'TripCancelled'
  | 'PickupConfirmed'
  | 'ReportSubmitted'
  | 'ReportFieldMissing'
  | 'OccurrenceCreated'
  | 'ApproachDetected'
  | 'ReceiverNotified'
  | 'ReceiverCallResult'
  | 'ArrivalRegistered'
  | 'TaskCreated'
  | 'TaskEscalated'
  | 'TaskAcknowledged'
  | 'UnloadConfirmed'
  | 'DocumentQuestionAnswered'
  | 'DriverRequestOpened'
  | 'DriverRequestReminder'
  | 'DriverRequestAnswered'
  | 'DriverRequestTimeout'
  | 'DriverAlert'
  | 'AgentDecision'
  | 'DriverMessageSent'
  | 'DriverMessageSpoken'
  | 'DriverMessageAnswered'
  /** Fala gravada sem sinal: o áudio sobe quando a rede volta e o agente processa no servidor. */
  | 'DriverVoiceNote'
  | 'DriverOffline'
  | 'TwilioCallFailed'
  | 'LiveKitFallbackStarted'
  | 'LiveKitFallbackAnswered'
  | 'AgentCallNoAnswer'
  | 'SupervisorEscalated';

export interface DomainEvent<T = Record<string, unknown>> {
  id: string;
  idempotencyKey: string;
  tripId: string;
  type: EventType;
  occurredAt: string;
  receivedAt?: string;
  source: 'driver' | 'agent' | 'cco' | 'system';
  payload: T;
}

/** Eventos que saem mesmo com rede fraca. */
export const CRITICAL_EVENTS: EventType[] = [
  'ArrivalRegistered',
  'OccurrenceCreated',
  'DriverRequestOpened',
  'UnloadConfirmed',
  'ReceiverCallResult',
  'DriverAlert',
  'SupervisorEscalated',
];
