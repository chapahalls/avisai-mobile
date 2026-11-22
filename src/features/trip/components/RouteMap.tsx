import { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { ENV } from '../../../lib/config';
import { RouteMapGoogle, isGoogleMapsNativeAvailable } from './RouteMapGoogle';
import { RouteMapSvg } from './RouteMapSvg';

export type MapMode = 'auto' | 'svg';

interface MapModeState {
  mapMode: MapMode;
  runtimeError: boolean;
  setMapMode: (mode: MapMode) => void;
  setRuntimeError: (hasError: boolean) => void;
  fallbackReason: () => 'maps_no_key' | 'maps_native_unavailable' | null;
}

export const useMapMode = create<MapModeState>((set, get) => ({
  mapMode: 'auto',
  runtimeError: false,
  setMapMode: (mapMode) => set({ mapMode, runtimeError: false }),
  setRuntimeError: (runtimeError) => set({ runtimeError }),
  fallbackReason: () => {
    const { mapMode, runtimeError } = get();
    if (mapMode === 'svg') return null;
    if (!ENV.hasGoogleMapsKey) return 'maps_no_key';
    if (runtimeError || !isGoogleMapsNativeAvailable()) return 'maps_native_unavailable';
    return null;
  },
}));

interface BoundaryProps {
  fallback: ReactNode;
  onError: () => void;
  children: ReactNode;
}

interface BoundaryState {
  hasError: boolean;
}

class MapErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * Wrapper com ErrorBoundary que seleciona `RouteMapGoogle` quando `ENV.hasGoogleMapsKey === true`,
 * módulo nativo disponível e `mapMode !== 'svg'`, fazendo fallback automático para `RouteMapSvg`.
 */
export function RouteMap({ fullScreen = false }: { fullScreen?: boolean }) {
  const { t } = useTranslation();
  const { mapMode, runtimeError, setRuntimeError } = useMapMode();

  const canUseGoogle =
    mapMode !== 'svg' &&
    ENV.hasGoogleMapsKey &&
    !runtimeError &&
    isGoogleMapsNativeAvailable();

  const svgFallback = <RouteMapSvg badgeLabel={t('trip.mapMock')} fullScreen={fullScreen} />;

  if (!canUseGoogle) {
    return svgFallback;
  }

  return (
    <MapErrorBoundary fallback={svgFallback} onError={() => setRuntimeError(true)}>
      <RouteMapGoogle onFallback={() => setRuntimeError(true)} fullScreen={fullScreen} />
    </MapErrorBoundary>
  );
}
