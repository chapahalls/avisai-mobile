import { create } from 'zustand';
import { ENV, type ApiMode } from '../lib/config';
import { getSetting, setSetting } from '../lib/db';
import type { ApiClient } from './apiClient';
import { httpApiClient } from './httpApi';
import { mockApiClient } from './mockApi';

export { setAccessToken } from './httpApi';

const DEFAULT_PRESET_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8000'
).replace(/\/+$/, '');
const MAX_RECENT_URLS = 3;

export interface ApiConfigState {
  mode: ApiMode;
  baseUrl: string;
  rotaId: number;
  driverId: number | null;
  recentUrls: string[];
  setMode: (mode: ApiMode) => void;
  setBaseUrl: (baseUrl: string) => void;
  addRecentUrl: (url: string) => void;
  setRotaId: (rotaId: number) => void;
  setDriverId: (driverId: number | null) => void;
}

export const useApiConfig = create<ApiConfigState>((set, get) => ({
  mode: ENV.apiMode,
  baseUrl: ENV.apiBaseUrl,
  rotaId: ENV.rotaId,
  driverId: 1,
  recentUrls: [DEFAULT_PRESET_URL],
  setMode: (mode) => {
    setSetting('api_mode', mode);
    set({ mode });
  },
  setBaseUrl: (baseUrl) => {
    const clean = (baseUrl.trim() || ENV.apiBaseUrl).replace(/\/+$/, '');
    setSetting('backend_url', clean);
    set({ baseUrl: clean });
  },
  addRecentUrl: (url) => {
    const clean = url.trim().replace(/\/+$/, '');
    if (!clean) return;
    const prev = get().recentUrls;
    const next = [clean, ...prev.filter((u) => u !== clean)].slice(0, MAX_RECENT_URLS);
    setSetting('recent_urls', JSON.stringify(next));
    set({ recentUrls: next });
  },
  setRotaId: (rotaId) =>
    set({
      rotaId: Number.isFinite(rotaId) && rotaId > 0 ? Math.floor(rotaId) : 1,
    }),
  setDriverId: (driverId) =>
    set({
      driverId:
        driverId !== null && Number.isFinite(driverId) && driverId > 0
          ? Math.floor(driverId)
          : null,
    }),
}));

export function loadPersistedApiConfig(): void {
  const savedUrl = getSetting('backend_url');
  const savedMode = getSetting('api_mode');
  const savedRecentRaw = getSetting('recent_urls');

  let recentUrls = [DEFAULT_PRESET_URL];
  if (savedRecentRaw) {
    try {
      const parsed: unknown = JSON.parse(savedRecentRaw);
      if (Array.isArray(parsed)) {
        const valid = parsed
          .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
          .map((u) => u.trim().replace(/\/+$/, ''));
        if (valid.length > 0) {
          recentUrls = Array.from(new Set([...valid, DEFAULT_PRESET_URL])).slice(
            0,
            MAX_RECENT_URLS,
          );
        }
      }
    } catch {
      // Mantém lista padrão caso JSON esteja inválido
    }
  }

  useApiConfig.setState((s) => ({
    // O build configurado para produção não pode ser desviado silenciosamente por um banco
    // SQLite antigo que ainda aponta para mock ou para outro computador.
    baseUrl: ENV.apiBaseUrlConfigured
      ? ENV.apiBaseUrl
      : savedUrl?.trim()
        ? savedUrl.trim().replace(/\/+$/, '')
        : s.baseUrl,
    mode: ENV.apiModeConfigured
      ? ENV.apiMode
      : savedMode === 'http' || savedMode === 'mock'
        ? savedMode
        : s.mode,
    recentUrls,
  }));
}

/** Alias de compatibilidade. */
export const useApiMode = useApiConfig;

export function getApiClient(): ApiClient {
  return useApiConfig.getState().mode === 'http' ? httpApiClient : mockApiClient;
}
