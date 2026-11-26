import { create } from 'zustand';
import { ENV } from '../../../lib/config';
import { getSetting, setSetting } from '../../../lib/db';
import { getApiClient, setAccessToken, useApiConfig } from '../../../services/api';
import { useDocuments } from '../../documents';
import { useTrip } from '../../trip';
import { useVoice } from '../../voice';
import { withDriverProfile } from '../api/claims';
import { DEFAULT_LOGIN_PROFILES, mergeWithBackendProfiles } from '../api/profiles';
import type { LoginProfileOption, Session } from '../types';

const DEFAULT_EMAIL = 'carlos@rotasul.test';
const PROFILE_SETTING_KEY = 'demo_profile_email';

export type AuthError = 'cancelled' | 'unreachable' | 'failed';

type KeycloakModule = typeof import('../api/keycloak');

/** Keycloak é carregado sob demanda para o modo mock (e os testes) não puxarem expo-auth-session. */
function loadKeycloak(): KeycloakModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../api/keycloak') as KeycloakModule;
}

/**
 * Login conforme ENV.authMode. No Keycloak, o access token vira o Bearer das chamadas HTTP e
 * motorista/viagem vêm do backend pelo e-mail (o token só traz identidade, papéis e empresas).
 */
async function authenticate(email: string, profiles: LoginProfileOption[]): Promise<Session> {
  if (ENV.authMode === 'keycloak') {
    const s = await loadKeycloak().keycloakLogin(email);
    setAccessToken(s.token);
    return withDriverProfile(s, profiles);
  }
  return getApiClient().ssoLogin(email);
}

interface SessionState {
  session: Session | null;
  loading: boolean;
  authError: AuthError | null;
  profiles: LoginProfileOption[];
  selectedEmail: string;
  loadingProfiles: boolean;
  selectProfile: (email: string) => void;
  loadProfiles: () => Promise<void>;
  login: (email?: string) => Promise<void>;
  logout: () => void;
}

/** SSO (ApiClient ou Keycloak conforme ENV.authMode) e seletor de perfis de motorista via ApiClient (mock por padrão ou HTTP real quando configurado). */
export const useSession = create<SessionState>((set, get) => ({
  session: null,
  loading: false,
  authError: null,
  profiles: DEFAULT_LOGIN_PROFILES,
  selectedEmail: getSetting(PROFILE_SETTING_KEY) || DEFAULT_EMAIL,
  loadingProfiles: false,

  selectProfile: (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    const match = get().profiles.find((p) => p.email.toLowerCase() === clean);
    const targetEmail = match?.email ?? clean;
    setSetting(PROFILE_SETTING_KEY, targetEmail);
    set({ selectedEmail: targetEmail });
  },

  loadProfiles: async () => {
    set({ loadingProfiles: true });
    try {
      const saved = getSetting(PROFILE_SETTING_KEY)?.trim().toLowerCase();
      const remote = await getApiClient().getDemoProfiles('driver');
      const profiles = mergeWithBackendProfiles(remote);
      const currentSelected = get().selectedEmail.trim().toLowerCase();
      const matched =
        profiles.find((p) => p.email.toLowerCase() === currentSelected) ??
        (saved ? profiles.find((p) => p.email.toLowerCase() === saved) : undefined) ??
        profiles[0];
      const nextEmail = matched?.email ?? DEFAULT_EMAIL;
      setSetting(PROFILE_SETTING_KEY, nextEmail);
      set({
        profiles,
        selectedEmail: nextEmail,
        loadingProfiles: false,
      });
    } catch {
      set({ loadingProfiles: false });
    }
  },

  login: async (email?: string) => {
    set({ loading: true, authError: null });
    try {
      const explicitEmail =
        typeof email === 'string' && email.trim().length > 0 ? email.trim() : undefined;
      const targetEmail = explicitEmail ?? get().selectedEmail ?? DEFAULT_EMAIL;
      const s = await authenticate(targetEmail, get().profiles);

      if (s.driverId !== undefined && s.driverId !== null) {
        useApiConfig.getState().setDriverId(s.driverId);
      }
      const rawTripId = s.tripId ?? (s.driverId ? String(s.driverId) : undefined);
      if (rawTripId) {
        const parsedRotaId = Number(String(rawTripId).replace(/^rota-|^trip-/, ''));
        if (Number.isFinite(parsedRotaId) && parsedRotaId > 0) {
          useApiConfig.getState().setRotaId(parsedRotaId);
        }
      }

      const resolvedEmail = s.email ?? targetEmail;
      setSetting(PROFILE_SETTING_KEY, resolvedEmail);

      useTrip.getState().reset();
      await useTrip.getState().syncRouteFromBackend();
      await useDocuments.getState().syncFromBackend();

      set({
        session: s,
        selectedEmail: resolvedEmail,
        loading: false,
      });
    } catch (err) {
      const code = (err as { code?: unknown })?.code;
      const authError: AuthError =
        code === 'cancelled' || code === 'unreachable' ? code : 'failed';
      set({ loading: false, authError: ENV.authMode === 'keycloak' ? authError : null });
    }
  },

  logout: () => {
    useVoice.getState().stop();
    useTrip.getState().reset();
    useDocuments.getState().reset();
    setAccessToken(null);
    if (ENV.authMode === 'keycloak') {
      void loadKeycloak().keycloakLogout();
    }
    set({ session: null, authError: null });
  },
}));
