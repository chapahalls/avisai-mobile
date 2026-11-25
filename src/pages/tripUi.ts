import type { TFunction } from 'i18next';
import type { BadgeTone } from '../components/Badge';
import type { ReceiverStatus } from '../features/trip';

/** Tom da etiqueta do recebedor: confirmado (ok), sem resposta/recusa (alerta), ligando, pendente. */
export function receiverTone(receiver: ReceiverStatus): BadgeTone {
  if (receiver.kind === 'confirmed') return 'ok';
  if (receiver.kind === 'no_answer' || receiver.kind === 'not_today') return 'alert';
  if (receiver.kind === 'calling') return 'brand';
  return 'wait';
}

/** Texto do estado do recebedor ("doca 4, 15:00", "não atendeu"…). */
export function receiverLabel(receiver: ReceiverStatus, t: TFunction): string {
  return receiver.kind === 'confirmed'
    ? t('trip.receiverStatus.confirmed', { dock: receiver.dock, time: receiver.time })
    : t(`trip.receiverStatus.${receiver.kind}`);
}
