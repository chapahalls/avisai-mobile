import { create } from 'zustand';
import { ssoLogin } from '../../../services/mockApi';
import type { Session } from '../types';

interface SessionState {
  session: Session | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => void;
}

/** SSO genérico mock. Para OIDC real: expo-auth-session no dev build. */
export const useSession = create<SessionState>((set) => ({
  session: null,
  loading: false,
  login: async () => {
    set({ loading: true });
    const s = await ssoLogin();
    set({ session: s, loading: false });
  },
  logout: () => set({ session: null }),
}));
