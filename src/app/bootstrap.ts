import { migrate } from '../lib/db';
import { loadPersistedLanguage } from '../lib/i18n';
import { loadPersistedApiConfig, useApiConfig } from '../services/api';
import { startBackendStreamWatcher } from '../services/backendStream';
import '../services/deviceGps';
import { startNetworkWatcher } from '../services/network';
import { startWakeWordWatcher } from '../services/wakeWord';
import { resetStuckSending, startSyncEngine, useOutboxStore } from '../features/outbox';
import {
  startDrivingModeWatcher,
  startTripSimulator,
  useTrip,
  wireTripToVoice,
  ROUTE,
} from '../features/trip';
import { loadPersistedVoiceMode, wireVoiceToBus } from '../features/voice';
import { indexDocuments } from '../features/documents';
import { wireBackendStream } from './wireBackendStream';

/** Liga tudo uma vez: banco, idioma/config persistida, rede, fila, stream WS, simulador, voz, wake word e índice vetorial. Retorna o "desligar". */
export function bootstrap() {
  migrate();
  loadPersistedLanguage();
  loadPersistedApiConfig();
  loadPersistedVoiceMode();
  if (useApiConfig.getState().mode === 'http') {
    void useTrip.getState().syncRouteFromBackend();
  }
  resetStuckSending();
  indexDocuments(ROUTE.tripId);
  useOutboxStore.getState().refresh();
  const stops = [
    startNetworkWatcher(),
    startSyncEngine(),
    wireBackendStream(),
    startBackendStreamWatcher(),
    wireVoiceToBus(),
    wireTripToVoice(),
    startTripSimulator(),
    startDrivingModeWatcher(),
    startWakeWordWatcher(),
  ];
  return () => stops.forEach((s) => s());
}
