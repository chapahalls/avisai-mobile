export type OutboxStatus = 'pending' | 'sending' | 'sent' | 'failed';

export interface OutboxRow {
  id: string;
  type: string;
  payload: string;
  idempotency_key: string;
  status: OutboxStatus;
  attempts: number;
  next_try_at: number;
  created_at: number;
}
