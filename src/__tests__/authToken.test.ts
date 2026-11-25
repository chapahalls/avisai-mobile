import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({}));

import { useApiConfig } from '../services/api';
import { getAccessToken, httpApiClient, setAccessToken } from '../services/httpApi';

const sso = {
  token: 'jwt.fixture.token',
  user: { id: '3', email: 'carlos@rotasul.test', name: 'Carlos', role: 'driver', driverId: 1, tripId: '1' },
};

describe('JWT do /auth/sso no app do motorista', () => {
  const calls: { url: string; headers: Record<string, string> }[] = [];

  beforeEach(() => {
    calls.length = 0;
    setAccessToken(null);
    useApiConfig.setState({ mode: 'http', baseUrl: 'http://backend.test', rotaId: 1, driverId: 1 });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, headers: (init.headers ?? {}) as Record<string, string> });
      const body = url.endsWith('/auth/sso') ? sso : [];
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setAccessToken(null);
  });

  it('guarda o token do login e manda como Bearer nas chamadas seguintes', async () => {
    const session = await httpApiClient.ssoLogin('carlos@rotasul.test');
    expect(session.token).toBe(sso.token);
    expect(getAccessToken()).toBe(sso.token);
    expect(calls[0].headers.Authorization).toBeUndefined();

    await httpApiClient.getDemoProfiles('driver');
    expect(calls.at(-1)?.headers.Authorization).toBe(`Bearer ${sso.token}`);
  });

  it('sem login (ou depois do logout) não manda cabeçalho de autorização', async () => {
    setAccessToken('  ');
    expect(getAccessToken()).toBeNull();
    await httpApiClient.getDemoProfiles('driver');
    expect(calls.at(-1)?.headers.Authorization).toBeUndefined();
  });

  it('se o backend falhar, o login cai no mock e não deixa token velho', async () => {
    setAccessToken('token.antigo');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('erro', { status: 500 })));
    await httpApiClient.ssoLogin('carlos@rotasul.test');
    expect(getAccessToken()).toBeNull();
  });
});
