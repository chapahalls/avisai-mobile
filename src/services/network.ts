import { create } from 'zustand';

/**
 * Estado da rede. `override` permite simular na demo: sem rede, rede fraca ou normal.
 * Rede "fraca" = ping alto ou falhas seguidas; aqui é simulada pelo override.
 */
export type NetworkQuality = 'online' | 'weak' | 'offline';

interface NetworkState {
  device: 'online' | 'offline';
  override: NetworkQuality | null;
  quality: () => NetworkQuality;
  setOverride: (q: NetworkQuality | null) => void;
}

export const useNetwork = create<NetworkState>((set, get) => ({
  device: 'online',
  override: null,
  quality: () => get().override ?? get().device,
  setOverride: (override) => set({ override }),
}));

export function startNetworkWatcher() {
  if (process.env.VITEST) return () => undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const NetInfo = require('@react-native-community/netinfo') as typeof import('@react-native-community/netinfo');
    const api = NetInfo.default ?? NetInfo;
    return api.addEventListener((s) => {
      useNetwork.setState({
        device: s.isConnected === false || s.isInternetReachable === false ? 'offline' : 'online',
      });
    });
  } catch {
    return () => undefined;
  }
}
