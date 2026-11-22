import { migrate } from '../lib/db';
import { loadPersistedLanguage } from '../lib/i18n';
import { loadPersistedApiConfig } from '../services/api';
import { startBackendStreamWatcher } from '../services/backendStream';
import { startNetworkWatcher } from '../services/network';
import { resetStuckSending, startSyncEngine, useOutboxStore } from '../features/outbox';
import { startTripSimulator, wireTripToVoice, ROUTE } from '../features/trip';
import { loadPersistedVoiceMode, wireVoiceToBus } from '../features/voice';
import { indexDocuments } from '../features/documents';

/** Liga tudo uma vez: banco, idioma/config persistida, rede, fila, stream WS, simulador, voz e índice vetorial. Retorna o "desligar". */
export function bootstrap() {
  migrate();
  loadPersistedLanguage();
  loadPersistedApiConfig();
  loadPersistedVoiceMode();
  resetStuckSending();
  indexDocuments(ROUTE.tripId);
  useOutboxStore.getState().refresh();
  const stops = [
    startNetworkWatcher(),
    startSyncEngine(),
    startBackendStreamWatcher(),
    wireVoiceToBus(),
    wireTripToVoice(),
    startTripSimulator(),
  ];
  return () => stops.forEach((s) => s());
}
