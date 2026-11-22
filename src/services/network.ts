import NetInfo from '@react-native-community/netinfo';
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
  return NetInfo.addEventListener((s) => {
    useNetwork.setState({ device: s.isConnected === false ? 'offline' : 'online' });
  });
}
