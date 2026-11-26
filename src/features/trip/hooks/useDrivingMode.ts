import { create } from 'zustand';
import { DRIVING_MODE } from '../../../lib/config';
import { agentBus } from '../../../services/agentBus';
import { useDeviceGps } from '../../../services/deviceGps';
import {
  INITIAL_DRIVING,
  currentSpeed,
  nextDriving,
  type DrivingDetector,
  type SpeedSource,
} from '../rules/drivingMode';
import { useTrip } from './useTrip';

export interface DrivingModeState {
  /** Caminhão andando: a tela trava e só a voz funciona. */
  driving: boolean;
  speedKmh: number | null;
  source: SpeedSource;
}

export const useDrivingMode = create<DrivingModeState>(() => ({
  driving: false,
  speedKmh: null,
  source: 'simulator',
}));

let detector: DrivingDetector = INITIAL_DRIVING;

/** Uma checagem: lê a velocidade (GPS ou simulador) e atualiza o estado. Exportada para os testes. */
export function evaluateDrivingMode(now = Date.now()): void {
  const gps = useDeviceGps.getState();
  const trip = useTrip.getState();
  const moving = trip.phase === 'driving' || trip.phase === 'approaching';
  const speed = currentSpeed({
    gpsEnabled: gps.enabled,
    gpsSpeedKmh: gps.lastSpeedKmh,
    gpsFixAt: gps.lastFixAt,
    simulatedKmh: moving ? trip.speedKmh : 0,
    now,
    staleFixMs: DRIVING_MODE.staleFixMs,
  });
  const wasDriving = detector.driving;
  detector = DRIVING_MODE.enabled ? nextDriving(detector, speed.kmh, now, DRIVING_MODE) : INITIAL_DRIVING;

  const kmh = speed.kmh === null ? null : Math.round(speed.kmh);
  const s = useDrivingMode.getState();
  // Só grava quando muda: a tela não redesenha a cada segundo à toa.
  if (s.driving !== detector.driving || s.speedKmh !== kmh || s.source !== speed.source) {
    useDrivingMode.setState({ driving: detector.driving, speedKmh: kmh, source: speed.source });
  }
  if (wasDriving !== detector.driving) {
    agentBus.emit('trip:driving_mode', { driving: detector.driving });
  }
}

/** Só para testes: volta ao estado parado. */
export function resetDrivingModeForTests(): void {
  detector = INITIAL_DRIVING;
  useDrivingMode.setState({ driving: false, speedKmh: null, source: 'simulator' });
}

/** Liga a checagem periódica (bootstrap). Retorna o "desligar". */
export function startDrivingModeWatcher(): () => void {
  evaluateDrivingMode();
  const timer = setInterval(() => evaluateDrivingMode(), DRIVING_MODE.tickMs);
  return () => clearInterval(timer);
}
