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
/** Até quando ignorar a velocidade depois de um "sair do modo direção" por voz. */
let suppressUntil = 0;

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
  const suppressed = now < suppressUntil;
  detector =
    DRIVING_MODE.enabled && !suppressed ? nextDriving(detector, speed.kmh, now, DRIVING_MODE) : INITIAL_DRIVING;

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

/**
 * Comando de voz "sair do modo direção" (como o "não estou dirigindo" do Android Auto): libera a
 * tela na hora e ignora a velocidade por `manualExitCooldownMs`, senão a próxima checagem (1 s)
 * trava de novo com o caminhão ainda andando.
 */
export function exitDrivingModeManually(now = Date.now()): void {
  const wasDriving = useDrivingMode.getState().driving;
  detector = INITIAL_DRIVING;
  suppressUntil = now + DRIVING_MODE.manualExitCooldownMs;
  useDrivingMode.setState({ driving: false });
  if (wasDriving) agentBus.emit('trip:driving_mode', { driving: false });
}

/** Só para testes: volta ao estado parado. */
export function resetDrivingModeForTests(): void {
  detector = INITIAL_DRIVING;
  suppressUntil = 0;
  useDrivingMode.setState({ driving: false, speedKmh: null, source: 'simulator' });
}

/** Liga a checagem periódica (bootstrap). Retorna o "desligar". */
export function startDrivingModeWatcher(): () => void {
  evaluateDrivingMode();
  const timer = setInterval(() => evaluateDrivingMode(), DRIVING_MODE.tickMs);
  return () => clearInterval(timer);
}
