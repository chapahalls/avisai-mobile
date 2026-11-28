import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DRIVING_MODE } from '../lib/config';
import { agentBus } from '../services/agentBus';
import { useDeviceGps } from '../services/deviceGps';
import {
  INITIAL_DRIVING,
  currentSpeed,
  nextDriving,
  type DrivingDetector,
} from '../features/trip/rules/drivingMode';
import {
  evaluateDrivingMode,
  resetDrivingModeForTests,
  useDrivingMode,
} from '../features/trip/hooks/useDrivingMode';
import { useTrip } from '../features/trip/hooks/useTrip';
import { speedBetweenKmh } from '../utils/geo';

vi.mock('react-native', () => ({}));
vi.mock('react-native-reanimated', () => ({
  default: { View: () => null },
  cancelAnimation: vi.fn(),
  Easing: {
    inOut: (value: unknown) => value,
    linear: 'linear',
    sin: 'sin',
  },
  useAnimatedStyle: () => ({}),
  useSharedValue: (value: number) => ({ value }),
  withRepeat: (animation: unknown) => animation,
  withSequence: (...animations: unknown[]) => animations[0],
  withSpring: (value: number) => value,
  withTiming: (value: number) => value,
}));
vi.mock('react-native-svg', () => ({
  default: () => null,
  Path: () => null,
  Circle: () => null,
  Line: () => null,
  Polyline: () => null,
  Rect: () => null,
}));

const cfg = { enterKmh: 10, enterHoldMs: 4000, exitKmh: 3, exitHoldMs: 5000 };

function run(speeds: (number | null)[], stepMs = 1000, start: DrivingDetector = INITIAL_DRIVING) {
  let s = start;
  speeds.forEach((v, i) => {
    s = nextDriving(s, v, i * stepMs, cfg);
  });
  return s;
}

describe('modo direção: detecção pela velocidade', () => {
  it('só entra depois de andar acima do limiar pelo tempo de espera', () => {
    expect(run([40, 40, 40, 40]).driving).toBe(false); // 3 s
    expect(run([40, 40, 40, 40, 40]).driving).toBe(true); // 4 s
  });

  it('uma arrancada curta não trava a tela', () => {
    expect(run([40, 40, 0, 40, 40, 40, 0]).driving).toBe(false);
  });

  it('no anda-e-para lento continua em direção (histerese) e só sai parado de verdade', () => {
    const driving: DrivingDetector = { driving: true, pendingSince: null };
    expect(run([6, 5, 7, 6, 5, 6, 6, 5], 1000, driving).driving).toBe(true);
    expect(run([0, 0, 0, 0, 0], 1000, driving).driving).toBe(true); // 4 s
    expect(run([0, 0, 0, 0, 0, 0], 1000, driving).driving).toBe(false); // 5 s
  });

  it('sem velocidade conhecida conta como parado', () => {
    expect(run([null, null, null, null, null, null], 1000, { driving: true, pendingSince: null }).driving).toBe(false);
    expect(run([null, null, null, null, null, null]).driving).toBe(false);
  });

  it('GPS ligado manda; posição velha é caminhão parado; sem GPS vale o simulador', () => {
    const base = { gpsSpeedKmh: 70, simulatedKmh: 80, now: 100_000, staleFixMs: 15_000 };
    expect(currentSpeed({ ...base, gpsEnabled: true, gpsFixAt: 95_000 })).toEqual({ kmh: 70, source: 'gps' });
    expect(currentSpeed({ ...base, gpsEnabled: true, gpsFixAt: 80_000 })).toEqual({ kmh: 0, source: 'gps' });
    expect(currentSpeed({ ...base, gpsEnabled: true, gpsFixAt: null })).toEqual({ kmh: 80, source: 'simulator' });
    expect(currentSpeed({ ...base, gpsEnabled: false, gpsFixAt: 95_000 })).toEqual({ kmh: 80, source: 'simulator' });
  });

  it('calcula a velocidade pela distância quando o aparelho não manda', () => {
    // ~1,11 km em 60 s ≈ 67 km/h
    const kmh = speedBetweenKmh({ lat: -23, lng: -47 }, 0, { lat: -23.01, lng: -47 }, 60_000);
    expect(kmh).toBeGreaterThan(60);
    expect(kmh).toBeLessThan(75);
    expect(speedBetweenKmh({ lat: 0, lng: 0 }, 1000, { lat: 0, lng: 0 }, 1000)).toBeNull();
  });
});

describe('modo direção: estado e aviso pelo agentBus', () => {
  beforeEach(() => {
    resetDrivingModeForTests();
    useDeviceGps.setState({ enabled: false, lastFixAt: null, lastSpeedKmh: null });
  });

  it('trava com a viagem andando no simulador e avisa a voz; libera ao chegar', () => {
    const events: boolean[] = [];
    const off = agentBus.on('trip:driving_mode', ({ driving }) => events.push(driving));
    useTrip.setState({ phase: 'driving', speedKmh: 80 });
    for (let t = 0; t <= DRIVING_MODE.enterHoldMs; t += 1000) evaluateDrivingMode(t);
    expect(useDrivingMode.getState()).toMatchObject({ driving: true, speedKmh: 80, source: 'simulator' });

    useTrip.setState({ phase: 'arrived', speedKmh: 0 });
    const t0 = DRIVING_MODE.enterHoldMs + 1000;
    for (let t = t0; t <= t0 + DRIVING_MODE.exitHoldMs; t += 1000) evaluateDrivingMode(t);
    expect(useDrivingMode.getState().driving).toBe(false);
    expect(events).toEqual([true, false]);
    off();
    useTrip.setState({ phase: 'idle', speedKmh: null });
  });
});
