import { create } from 'zustand';
import type { LatLng } from '../types/geo';
import { getApiClient, useApiConfig } from './api';

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

export interface DeviceGpsState {
  enabled: boolean;
  lastPosition: LatLng | null;
  lastSpeedKmh: number | null;
  error: string | null;
  setEnabled: (enabled: boolean) => void;
}

let activeStop: (() => void) | null = null;
let lastSentAt = 0;

function stopActiveWatcher() {
  if (activeStop) {
    activeStop();
    activeStop = null;
  }
}

function handleCoords(coords: GeolocationCoords, onPosition?: (pos: LatLng, speedKmh: number | null) => void) {
  const lat = coords.latitude;
  const lng = coords.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const speedKmh =
    typeof coords.speed === 'number' && coords.speed >= 0
      ? Math.round(coords.speed * 3.6)
      : null;
  const accuracyM =
    typeof coords.accuracy === 'number' && coords.accuracy >= 0
      ? Math.round(coords.accuracy)
      : undefined;

  useDeviceGps.setState({
    lastPosition: { lat, lng },
    lastSpeedKmh: speedKmh,
    error: null,
  });

  onPosition?.({ lat, lng }, speedKmh);

  const now = Date.now();
  if (now - lastSentAt < 2500) return;
  lastSentAt = now;

  const { mode, rotaId } = useApiConfig.getState();
  if (mode === 'http') {
    void getApiClient()
      .sendPosition(rotaId, {
        lat,
        lng,
        velocidade_kmh: speedKmh ?? undefined,
        precisao_m: accuracyM,
        fonte: 'celular',
      })
      .catch(() => undefined);
  }
}

function startNativeWatcher(onPosition?: (pos: LatLng, speedKmh: number | null) => void): () => void {
  if (process.env.VITEST) {
    return () => undefined;
  }

  const navGeo = (globalThis as unknown as { navigator?: { geolocation?: NavigatorGeolocation } })
    .navigator?.geolocation;

  if (navGeo && typeof navGeo.watchPosition === 'function') {
    const watchId = navGeo.watchPosition(
      (pos) => handleCoords(pos.coords, onPosition),
      (err) => {
        useDeviceGps.setState({ error: err?.message || 'gps_unavailable' });
      },
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

  // Fallback opcional via lazy require caso expo-location esteja presente no runtime
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExpoLocation = require('expo-location') as {
      requestForegroundPermissionsAsync?: () => Promise<{ status: string }>;
      watchPositionAsync?: (
        opts: { accuracy?: number; timeInterval?: number; distanceInterval?: number },
        cb: (loc: { coords: GeolocationCoords }) => void,
      ) => Promise<{ remove: () => void }>;
    };
    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    if (
      typeof ExpoLocation?.requestForegroundPermissionsAsync === 'function' &&
      typeof ExpoLocation?.watchPositionAsync === 'function'
    ) {
      void ExpoLocation.requestForegroundPermissionsAsync()
        .then(async (perm) => {
          if (cancelled || perm.status !== 'granted') {
            if (!cancelled) useDeviceGps.setState({ error: 'gps_permission_denied' });
            return;
          }
          const s = await ExpoLocation.watchPositionAsync!(
            { timeInterval: 3000, distanceInterval: 15 },
            (loc) => handleCoords(loc.coords, onPosition),
          );
          if (cancelled) {
            s.remove();
          } else {
            sub = s;
          }
        })
        .catch(() => {
          if (!cancelled) useDeviceGps.setState({ error: 'gps_unavailable' });
        });
      return () => {
        cancelled = true;
        sub?.remove();
      };
    }
  } catch {
    // expo-location não instalado — segue sem crash
  }

  useDeviceGps.setState({ error: 'gps_unavailable' });
  return () => undefined;
}

export const useDeviceGps = create<DeviceGpsState>((set) => ({
  enabled: false,
  lastPosition: null,
  lastSpeedKmh: null,
  error: null,
  setEnabled: (enabled) => {
    stopActiveWatcher();
    set({ enabled, error: null });
    if (enabled) {
      activeStop = startNativeWatcher();
    }
  },
}));
