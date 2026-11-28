import { create } from 'zustand';
import type { LatLng } from '../types/geo';
import { getApiClient, useApiConfig } from './api';
import { colors } from '../lib/theme';
import { speedBetweenKmh } from '../utils/geo';

interface GeolocationCoords {
  latitude: number;
  longitude: number;
  speed?: number | null;
  accuracy?: number | null;
}

interface GeolocationPosition {
  coords: GeolocationCoords;
}

interface GeolocationError {
  message?: string;
}

interface NavigatorGeolocation {
  watchPosition: (
    success: (pos: GeolocationPosition) => void,
    error?: (err: GeolocationError) => void,
    options?: { enableHighAccuracy?: boolean; distanceFilter?: number; maximumAge?: number },
  ) => number;
  clearWatch: (watchId: number) => void;
}

interface ExpoLocationSubscription {
  remove: () => void;
}

interface ExpoLocationModule {
  Accuracy?: { High?: number };
  requestForegroundPermissionsAsync?: () => Promise<{ status: string }>;
  requestBackgroundPermissionsAsync?: () => Promise<{ status: string }>;
  hasStartedLocationUpdatesAsync?: (taskName: string) => Promise<boolean>;
  startLocationUpdatesAsync?: (
    taskName: string,
    options: {
      accuracy?: number;
      timeInterval?: number;
      distanceInterval?: number;
      foregroundService?: {
        notificationTitle: string;
        notificationBody: string;
        notificationColor?: string;
        killServiceOnDestroy?: boolean;
      };
    },
  ) => Promise<void>;
  stopLocationUpdatesAsync?: (taskName: string) => Promise<void>;
  watchPositionAsync?: (
    opts: { accuracy?: number; timeInterval?: number; distanceInterval?: number },
    cb: (loc: { coords: GeolocationCoords }) => void,
    errorHandler?: (reason: string) => void,
  ) => Promise<ExpoLocationSubscription>;
}

interface ExpoTaskManagerModule {
  isTaskDefined?: (taskName: string) => boolean;
  defineTask?: (
    taskName: string,
    executor: (body: {
      data?: { locations?: { coords?: GeolocationCoords }[] };
      error?: { message?: string } | null;
    }) => void | Promise<void>,
  ) => void;
}

export interface DeviceGpsState {
  enabled: boolean;
  lastPosition: LatLng | null;
  lastSpeedKmh: number | null;
  /** Hora (ms) da última posição recebida: sem posição nova há tempo, o caminhão está parado. */
  lastFixAt: number | null;
  error: string | null;
  setEnabled: (enabled: boolean) => void;
}

const BACKGROUND_GPS_TASK = 'avisai-background-location';
let activeStop: (() => void) | null = null;
let lastSentAt = 0;

function loadExpoLocation(): ExpoLocationModule | null {
  if (process.env.VITEST) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-location') as ExpoLocationModule;
  } catch {
    return null;
  }
}

function loadTaskManager(): ExpoTaskManagerModule | null {
  if (process.env.VITEST) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-task-manager') as ExpoTaskManagerModule;
  } catch {
    return null;
  }
}

function applyBackendPosition(
  lat: number,
  lng: number,
  result: {
    rota_id: number;
    distancia_m: number;
    eta_min: number;
    status:
      | 'publicada'
      | 'planejada'
      | 'na_origem'
      | 'em_transito'
      | 'aproximando'
      | 'no_destino'
      | 'descarregada'
      | 'cancelada';
  },
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTrip } = require('../features/trip') as typeof import('../features/trip');
    useTrip.getState().applyBackendPosicao({
      rota_id: result.rota_id,
      lat,
      lng,
      distancia_m: result.distancia_m,
      eta_min: result.eta_min,
      status: result.status,
    });
  } catch {
    // O rastreador continua funcional mesmo antes do estado de viagem carregar.
  }
}

function stopActiveWatcher() {
  if (activeStop) {
    activeStop();
    activeStop = null;
  }
}

function stopBackgroundTracking() {
  const ExpoLocation = loadExpoLocation();
  if (!ExpoLocation?.stopLocationUpdatesAsync) return;
  void ExpoLocation.stopLocationUpdatesAsync(BACKGROUND_GPS_TASK).catch(() => undefined);
}

function handleCoords(coords: GeolocationCoords) {
  const lat = coords.latitude;
  const lng = coords.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const now = Date.now();
  const prev = useDeviceGps.getState();
  // Sem velocidade do aparelho (-1 ou vazia): calcula pela distância desde a posição anterior.
  const speedKmh =
    typeof coords.speed === 'number' && coords.speed >= 0
      ? Math.round(coords.speed * 3.6)
      : prev.lastPosition && prev.lastFixAt !== null
        ? speedBetweenKmh(prev.lastPosition, prev.lastFixAt, { lat, lng }, now)
        : null;
  const accuracyM =
    typeof coords.accuracy === 'number' && coords.accuracy >= 0
      ? Math.round(coords.accuracy)
      : undefined;

  useDeviceGps.setState({
    lastPosition: { lat, lng },
    lastSpeedKmh: speedKmh,
    lastFixAt: now,
    error: null,
  });

  if (now - lastSentAt < 2500) return;
  lastSentAt = now;

  const { mode, rotaId } = useApiConfig.getState();
  if (mode !== 'http') return;

  void getApiClient()
    .sendPosition(rotaId, {
      lat,
      lng,
      velocidade_kmh: speedKmh ?? undefined,
      precisao_m: accuracyM,
      fonte: 'celular',
    })
    .then((result) => applyBackendPosition(lat, lng, result))
    .catch(() => {
      // Não interrompe o GPS por uma perda pontual de rede. A próxima posição tenta novamente.
      useDeviceGps.setState({ error: 'gps_position_not_sent' });
    });
}

function defineBackgroundTask() {
  const ExpoLocation = loadExpoLocation();
  const TaskManager = loadTaskManager();
  if (
    !ExpoLocation ||
    !TaskManager?.defineTask ||
    TaskManager.isTaskDefined?.(BACKGROUND_GPS_TASK)
  ) {
    return;
  }

  try {
    TaskManager.defineTask(BACKGROUND_GPS_TASK, ({ data, error }) => {
      if (error) {
        useDeviceGps.setState({ error: error.message || 'gps_background_error' });
        return;
      }
      const locations = data?.locations;
      if (!Array.isArray(locations)) return;
      for (const location of locations) {
        if (location?.coords) handleCoords(location.coords);
      }
    });
  } catch {
    // Sem Task Manager (por exemplo, runtime de teste) o rastreamento em primeiro plano continua.
  }
}

// Expo Task Manager exige a definição global para que o processo em segundo plano consiga acordar o app.
defineBackgroundTask();

async function startBackgroundTracking(ExpoLocation: ExpoLocationModule) {
  if (
    !ExpoLocation.requestBackgroundPermissionsAsync ||
    !ExpoLocation.hasStartedLocationUpdatesAsync ||
    !ExpoLocation.startLocationUpdatesAsync
  ) {
    return;
  }

  try {
    const background = await ExpoLocation.requestBackgroundPermissionsAsync();
    if (background.status !== 'granted') return;

    const started = await ExpoLocation.hasStartedLocationUpdatesAsync(BACKGROUND_GPS_TASK);
    if (!started) {
      await ExpoLocation.startLocationUpdatesAsync(BACKGROUND_GPS_TASK, {
        accuracy: ExpoLocation.Accuracy?.High ?? 4,
        timeInterval: 5000,
        distanceInterval: 15,
        foregroundService: {
          notificationTitle: 'AvisAI rastreando viagem',
          notificationBody: 'Sua localização está sendo enviada para a rota ativa.',
          notificationColor: colors.ok[500],
          killServiceOnDestroy: false,
        },
      });
    }
  } catch {
    // Atualizações em primeiro plano continuam mesmo se "Sempre permitir" for recusado.
  }
}

function startExpoWatcher(ExpoLocation: ExpoLocationModule): () => void {
  let subscription: ExpoLocationSubscription | null = null;
  let cancelled = false;
  const requestForeground = ExpoLocation.requestForegroundPermissionsAsync;
  const watchPosition = ExpoLocation.watchPositionAsync;

  if (!requestForeground || !watchPosition) {
    useDeviceGps.setState({ error: 'gps_unavailable' });
    return () => undefined;
  }

  void requestForeground()
    .then(async (permission) => {
      if (cancelled) return;
      if (permission?.status !== 'granted') {
        useDeviceGps.setState({ error: 'gps_permission_denied' });
        return;
      }

      const watcher = await watchPosition(
        {
          accuracy: ExpoLocation.Accuracy?.High ?? 4,
          timeInterval: 3000,
          distanceInterval: 15,
        },
        (location) => handleCoords(location.coords),
        (message) => useDeviceGps.setState({ error: message || 'gps_unavailable' }),
      );
      if (cancelled) {
        watcher.remove();
        return;
      }
      subscription = watcher;

      // O pedido de "Sempre permitir" é explícito no momento em que o motorista liga o GPS.
      void startBackgroundTracking(ExpoLocation);
    })
    .catch(() => {
      if (!cancelled) useDeviceGps.setState({ error: 'gps_unavailable' });
    });

  return () => {
    cancelled = true;
    subscription?.remove();
  };
}

function startNativeWatcher(): () => void {
  if (process.env.VITEST) {
    return () => undefined;
  }

  const ExpoLocation = loadExpoLocation();
  if (ExpoLocation?.requestForegroundPermissionsAsync && ExpoLocation.watchPositionAsync) {
    return startExpoWatcher(ExpoLocation);
  }

  const navGeo = (globalThis as unknown as { navigator?: { geolocation?: NavigatorGeolocation } })
    .navigator?.geolocation;
  if (navGeo && typeof navGeo.watchPosition === 'function') {
    const watchId = navGeo.watchPosition(
      (pos) => handleCoords(pos.coords),
      (err) => useDeviceGps.setState({ error: err?.message || 'gps_unavailable' }),
      { enableHighAccuracy: true, distanceFilter: 15, maximumAge: 3000 },
    );
    return () => {
      try {
        navGeo.clearWatch(watchId);
      } catch {
        // Ignora erro ao encerrar watchPosition
      }
    };
  }

  useDeviceGps.setState({ error: 'gps_unavailable' });
  return () => undefined;
}

export const useDeviceGps = create<DeviceGpsState>((set) => ({
  enabled: false,
  lastPosition: null,
  lastSpeedKmh: null,
  lastFixAt: null,
  error: null,
  setEnabled: (enabled) => {
    stopActiveWatcher();
    if (!enabled) stopBackgroundTracking();
    set({ enabled, error: null, lastFixAt: null, lastSpeedKmh: null });
    if (enabled) {
      activeStop = startNativeWatcher();
    }
  },
}));
