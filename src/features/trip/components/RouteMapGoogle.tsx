import { useRef } from 'react';
import { Pressable, Text, UIManager, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BUSINESS } from '../../../lib/config';
import { distanceKm } from '../../../utils/geo';
import { hapticTap } from '../../../utils/haptics';
import { useTrip } from '../hooks/useTrip';
import type { LatLng } from '../../../types/geo';
import type { TripPhase } from '../types';

type RNMapsModule = typeof import('react-native-maps');

function loadRNMaps(): RNMapsModule | null {
  try {
    const hasViewConfig = Boolean(UIManager.getViewManagerConfig?.('AIRMap'));
    if (!hasViewConfig) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-maps') as RNMapsModule;
    return mod?.default ? mod : null;
  } catch {
    return null;
  }
}

export function isGoogleMapsNativeAvailable(): boolean {
  return loadRNMaps() !== null;
}

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0B1220' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#A7B1C6' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0B1220' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1A2438' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2A3550' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#121A2B' }] },
];

const phaseDotColor: Record<TripPhase, string> = {
  idle: 'bg-ink-300',
  pickup: 'bg-brand-500',
  driving: 'bg-brand-500',
  approaching: 'bg-wait-500',
  arrived: 'bg-ok-500',
  waiting: 'bg-wait-500',
  unloaded: 'bg-ok-500',
};

const toCoord = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng });

export function RouteMapGoogle({
  onFallback,
  fullScreen = false,
}: {
  onFallback?: () => void;
  fullScreen?: boolean;
}) {
  const { t } = useTranslation();
  const position = useTrip((s) => s.position);
  const phase = useTrip((s) => s.phase);
  const activeRoute = useTrip((s) => s.activeRoute);
  const etaMin = useTrip((s) => s.etaMin);
  const leftKm = distanceKm(position, activeRoute.destination.position);
  const computedEta =
    etaMin !== null
      ? etaMin
      : leftKm > 0.3
        ? Math.max(1, Math.round((leftKm / 80) * 60))
        : 0;
  const mapRef = useRef<{
    animateToRegion?: (
      region: {
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
      },
      duration?: number,
    ) => void;
    fitToCoordinates?: (
      coords: { latitude: number; longitude: number }[],
      options?: {
        edgePadding?: { top: number; right: number; bottom: number; left: number };
        animated?: boolean;
      },
    ) => void;
  } | null>(null);
  const maps = loadRNMaps();

  if (!maps) {
    onFallback?.();
    return null;
  }

  const MapView = maps.default;
  const { Polyline, Marker, Circle, PROVIDER_GOOGLE } = maps;

  const originCoord = toCoord(activeRoute.origin.position);
  const destCoord = toCoord(activeRoute.destination.position);
  const truckCoord = toCoord(position);
  const routeCoords = activeRoute.path.map(toCoord);

  const midLat = (activeRoute.origin.position.lat + activeRoute.destination.position.lat) / 2;
  const midLng = (activeRoute.origin.position.lng + activeRoute.destination.position.lng) / 2;
  const latDelta = Math.abs(activeRoute.destination.position.lat - activeRoute.origin.position.lat) * 1.45 || 0.25;
  const lngDelta = Math.abs(activeRoute.destination.position.lng - activeRoute.origin.position.lng) * 1.45 || 0.25;

  return (
    <View
      className={`${fullScreen ? 'flex-1 ' : ''}bg-ink-900 border border-ink-700/80 rounded-2xl overflow-hidden`}
    >
      <View className={fullScreen ? 'relative flex-1' : 'relative'}>
        <MapView
          ref={(instance) => {
            mapRef.current = instance;
          }}
          provider={PROVIDER_GOOGLE}
          style={fullScreen ? { width: '100%', flex: 1 } : { width: '100%', height: 240 }}
          customMapStyle={DARK_MAP_STYLE}
          initialRegion={{
            latitude: midLat,
            longitude: midLng,
            latitudeDelta: latDelta,
            longitudeDelta: lngDelta,
          }}
        >
          <Polyline coordinates={routeCoords} strokeColor="#099DFD" strokeWidth={4} />
          <Circle
            center={originCoord}
            radius={BUSINESS.geofenceMeters}
            strokeColor="#099DFD"
            fillColor="rgba(9, 157, 253, 0.18)"
          />
          <Circle
            center={destCoord}
            radius={BUSINESS.geofenceMeters}
            strokeColor="#F5A524"
            fillColor="rgba(245, 165, 36, 0.20)"
          />
          <Marker coordinate={originCoord} title={activeRoute.origin.name} pinColor="#099DFD" />
          <Marker coordinate={destCoord} title={activeRoute.destination.name} pinColor="#F5A524" />
          <Marker coordinate={truckCoord} title={activeRoute.plate} pinColor="#17B26A" />
        </MapView>

        {/* Overlays superiores flutuantes */}
        <View className="absolute top-3 left-3 right-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5 bg-ink-950/85 border border-ink-700/80 rounded-full px-3 py-1.5">
            <View className={`w-2 h-2 rounded-full ${phaseDotColor[phase]}`} />
            <Text className="text-ink-50 text-xs font-semibold">{t(`trip.phase.${phase}`)}</Text>
          </View>
          <View className="bg-ink-950/85 border border-ink-700/80 rounded-full px-3 py-1.5 flex-row items-center gap-1.5">
            <Text
              className="text-brand-500 text-xs font-bold"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {t('trip.left', { km: leftKm.toFixed(1) })}
            </Text>
            {computedEta > 0 && (
              <Text
                className="text-ink-300 text-xs font-semibold"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                · {t('map.etaShort', { min: computedEta })}
              </Text>
            )}
          </View>
        </View>

        {/* Botões flutuantes de auto-foco (Caminhão / Rota — B3) */}
        <View className="absolute bottom-3 right-3 flex-row items-center gap-1.5">
          <Pressable
            onPress={() => {
              hapticTap();
              mapRef.current?.animateToRegion?.(
                {
                  latitude: truckCoord.latitude,
                  longitude: truckCoord.longitude,
                  latitudeDelta: 0.035,
                  longitudeDelta: 0.035,
                },
                500,
              );
            }}
            accessibilityRole="button"
            className="bg-ink-950/90 border border-brand-500/60 rounded-full px-3 py-1.5 active:opacity-80"
          >
            <Text className="text-brand-500 text-xs font-bold">{t('map.focusTruck')}</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              hapticTap();
              mapRef.current?.fitToCoordinates?.(routeCoords, {
                edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
                animated: true,
              });
            }}
            accessibilityRole="button"
            className="bg-ink-950/90 border border-ink-700 rounded-full px-3 py-1.5 active:opacity-80"
          >
            <Text className="text-ink-50 text-xs font-bold">{t('map.fitRoute')}</Text>
          </Pressable>
        </View>
      </View>

      <View className="flex-row items-center justify-between px-3.5 py-2.5 border-t border-ink-700/80 bg-ink-900 gap-2">
        <View className="flex-1 flex-row items-center gap-1.5">
          <View className="w-2 h-2 rounded-full bg-brand-500" />
          <Text numberOfLines={1} className="flex-1 text-ink-50 text-xs font-medium">
            {activeRoute.origin.name}
          </Text>
        </View>
        <View className="bg-brand-500/15 border border-brand-500/50 rounded-full px-2 py-0.5">
          <Text numberOfLines={1} className="text-brand-500 text-[10px] font-semibold">
            {t('trip.mapGoogle')}
          </Text>
        </View>
        <View className="flex-1 flex-row items-center justify-end gap-1.5">
          <Text numberOfLines={1} className="flex-1 text-right text-ink-50 text-xs font-medium">
            {activeRoute.destination.name}
          </Text>
          <View className="w-2 h-2 rounded-full bg-wait-500" />
        </View>
      </View>
    </View>
  );
}
