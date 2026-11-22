import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({}));
vi.mock('react-native-svg', () => ({
  default: () => null,
  Path: () => null,
  Circle: () => null,
  Line: () => null,
  Polyline: () => null,
  Rect: () => null,
}));

import {
  DEFAULT_LOGIN_PROFILES,
  mergeWithBackendProfiles,
  useSession,
} from '../features/auth';
import { useDocuments } from '../features/documents';
import { useTrip } from '../features/trip';
import { useVoice } from '../features/voice';
import i18n from '../lib/i18n';
import { useApiConfig } from '../services/api';
import { httpApiClient } from '../services/httpApi';
import type { DemoProfile } from '../types/backend';

describe('3-option Driver Profile Switcher & SSO Login (PERFIS-DEMO)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR');
    useApiConfig.setState({
      mode: 'mock',
      baseUrl: 'http://localhost:8000',
      rotaId: 1,
      driverId: 1,
      recentUrls: ['http://localhost:8000'],
    });
    useTrip.getState().reset();
    useVoice.getState().reset();
    useDocuments.getState().reset();
    useSession.setState({
      session: null,
      loading: false,
      profiles: DEFAULT_LOGIN_PROFILES,
      selectedEmail: 'carlos@rotasul.test',
      loadingProfiles: false,
    });
  });

  it('DEFAULT_LOGIN_PROFILES possui exatamente as 3 opcoes canonicas de motorista', () => {
    expect(DEFAULT_LOGIN_PROFILES).toHaveLength(3);
    expect(DEFAULT_LOGIN_PROFILES.map((p) => p.email)).toEqual([
      'carlos@rotasul.test',
      'marina@rotasul.test',
      'joao@rotasul.test',
    ]);
    expect(DEFAULT_LOGIN_PROFILES.map((p) => p.plate)).toEqual([
      'RST-4B21',
      'DMO-2A02',
      'DMO-3A03',
    ]);
  });

  it('mergeWithBackendProfiles enriquece IDs, nomes e tripIds vivos do backend mantendo teto de 3 opcoes', () => {
    const remote: DemoProfile[] = [
      {
        id: 'backend-driver-1',
        email: 'carlos@rotasul.test',
        name: 'Carlos Andrade (Live)',
        role: 'driver',
        driverId: 1,
        tripId: '1',
      },
      {
        id: 'backend-driver-2',
        email: 'marina@rotasul.test',
        name: 'Marina Souza (Live)',
        role: 'driver',
        driverId: 2,
        tripId: '2',
      },
      {
        id: 'backend-driver-3',
        email: 'joao@rotasul.test',
        name: 'João Pereira (Live)',
        role: 'driver',
        driverId: 3,
        tripId: '3',
      },
      {
        id: 'backend-driver-4',
        email: 'extra@rotasul.test',
        name: 'Motorista Extra',
        role: 'driver',
        driverId: 4,
        tripId: null,
      },
      {
        id: 'backend-cco-1',
        email: 'cco@rotasul.test',
        name: 'Operadora CCO',
        role: 'cco',
        driverId: null,
        tripId: null,
      },
    ];

    const merged = mergeWithBackendProfiles(remote);
    expect(merged).toHaveLength(3);
    expect(merged[0]?.id).toBe('backend-driver-1');
    expect(merged[0]?.name).toBe('Carlos Andrade (Live)');
    expect(merged[0]?.plate).toBe('RST-4B21');
    expect(merged[1]?.id).toBe('backend-driver-2');
    expect(merged[1]?.tripId).toBe('2');
    expect(merged[2]?.id).toBe('backend-driver-3');
    expect(merged[2]?.tripId).toBe('3');
  });

  it('seleciona Marina, faz login sincronizando rota DMO-2A02, faz logout e alterna para Joao (DMO-3A03)', async () => {
    // 1. Selecionar Marina
    useSession.getState().selectProfile('marina@rotasul.test');
    expect(useSession.getState().selectedEmail).toBe('marina@rotasul.test');

    // 2. Login como Marina
    await useSession.getState().login();
    const marinaSession = useSession.getState().session;
    expect(marinaSession).not.toBeNull();
    expect(marinaSession?.email).toBe('marina@rotasul.test');
    expect(marinaSession?.driverId).toBe(2);
    expect(marinaSession?.tripId).toBe('2');
    expect(useApiConfig.getState().driverId).toBe(2);
    expect(useApiConfig.getState().rotaId).toBe(2);
    expect(useTrip.getState().activeRoute.plate).toBe('DMO-2A02');
    expect(useTrip.getState().activeRoute.invoice).toBe('DEMO-AVISAI-002');
    expect(useDocuments.getState().documents[0]?.fields.numero).toBe('DEMO-AVISAI-002');

    // 3. Logout limpa sessao e reseta viagem
    useSession.getState().logout();
    expect(useSession.getState().session).toBeNull();
    expect(useTrip.getState().phase).toBe('idle');

    // 4. Selecionar João e fazer login
    useSession.getState().selectProfile('joao@rotasul.test');
    expect(useSession.getState().selectedEmail).toBe('joao@rotasul.test');
    await useSession.getState().login();

    const joaoSession = useSession.getState().session;
    expect(joaoSession?.email).toBe('joao@rotasul.test');
    expect(joaoSession?.driverId).toBe(3);
    expect(joaoSession?.tripId).toBe('3');
    expect(useApiConfig.getState().driverId).toBe(3);
    expect(useApiConfig.getState().rotaId).toBe(3);
    expect(useTrip.getState().activeRoute.plate).toBe('DMO-3A03');
    expect(useTrip.getState().activeRoute.invoice).toBe('DEMO-AVISAI-003');
    expect(useDocuments.getState().documents[0]?.fields.numero).toBe('DEMO-AVISAI-003');
  });

  it('httpApiClient.getDemoProfiles("driver") consulta /api/users?role=driver e retorna DemoProfile[]', async () => {
    const mockUsers: DemoProfile[] = [
      {
        id: 'u-driver-1',
        email: 'carlos@rotasul.test',
        name: 'Carlos Andrade',
        role: 'driver',
        driverId: 1,
        tripId: '1',
      },
      {
        id: 'u-driver-2',
        email: 'marina@rotasul.test',
        name: 'Marina Souza',
        role: 'driver',
        driverId: 2,
        tripId: '2',
      },
      {
        id: 'u-driver-3',
        email: 'joao@rotasul.test',
        name: 'João Pereira',
        role: 'driver',
        driverId: 3,
        tripId: '3',
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockUsers), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      const profiles = await httpApiClient.getDemoProfiles('driver');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]?.[0]).toBe('http://localhost:8000/api/users?role=driver');
      expect(profiles).toEqual(mockUsers);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
