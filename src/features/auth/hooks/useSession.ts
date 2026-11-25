import { create } from 'zustand';
import { getSetting, setSetting } from '../../../lib/db';
import { getApiClient, setAccessToken, useApiConfig } from '../../../services/api';
import { useDocuments } from '../../documents';
import { useTrip } from '../../trip';
import { useVoice } from '../../voice';
import { DEFAULT_LOGIN_PROFILES, mergeWithBackendProfiles } from '../api/profiles';
import type { LoginProfileOption, Session } from '../types';

const DEFAULT_EMAIL = 'carlos@rotasul.test';
const PROFILE_SETTING_KEY = 'demo_profile_email';

interface SessionState {
  session: Session | null;
  loading: boolean;
  profiles: LoginProfileOption[];
  selectedEmail: string;
  loadingProfiles: boolean;
  selectProfile: (email: string) => void;
  loadProfiles: () => Promise<void>;
  login: (email?: string) => Promise<void>;
  logout: () => void;
}

/** SSO e seletor de perfis de motorista via ApiClient (mock por padrão ou HTTP real quando configurado). */
export const useSession = create<SessionState>((set, get) => ({
  session: null,
  loading: false,
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
    set({ loading: true });
    try {
      const explicitEmail =
        typeof email === 'string' && email.trim().length > 0 ? email.trim() : undefined;
      const targetEmail = explicitEmail ?? get().selectedEmail ?? DEFAULT_EMAIL;
      const s = await getApiClient().ssoLogin(targetEmail);

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
    } catch {
      set({ loading: false });
    }
  },

  logout: () => {
    useVoice.getState().stop();
    useTrip.getState().reset();
    useDocuments.getState().reset();
    setAccessToken(null);
    set({ session: null });
  },
}));
