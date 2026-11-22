import { migrate } from '../lib/db';
import { startNetworkWatcher } from '../services/network';
import { startSyncEngine, useOutboxStore } from '../features/outbox';
import { startTripSimulator, wireTripToVoice, ROUTE } from '../features/trip';
import { wireVoiceToBus } from '../features/voice';
import { indexDocuments } from '../features/documents';

/** Liga tudo uma vez: banco, rede, fila, simulador, voz e índice vetorial. Retorna o "desligar". */
export function bootstrap() {
  migrate();
  indexDocuments(ROUTE.tripId);
  useOutboxStore.getState().refresh();
  const stops = [startNetworkWatcher(), startSyncEngine(), wireVoiceToBus(), wireTripToVoice(), startTripSimulator()];
  return () => stops.forEach((s) => s());
}
