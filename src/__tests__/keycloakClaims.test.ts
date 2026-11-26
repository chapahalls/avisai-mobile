import { describe, expect, it } from 'vitest';
import { decodeJwtPayload, sessionFromClaims, withDriverProfile } from '../features/auth/api/claims';
import { DEFAULT_LOGIN_PROFILES } from '../features/auth/api/profiles';

function fakeJwt(payload: object): string {
  const b64url = (s: string) =>
    Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url('{"alg":"none"}')}.${b64url(JSON.stringify(payload))}.sig`;
}

describe('Keycloak claims (realm rodar)', () => {
  it('decodifica payload UTF-8 (João)', () => {
    const claims = decodeJwtPayload<{ name: string }>(fakeJwt({ name: 'João Pereira' }));
    expect(claims.name).toBe('João Pereira');
  });

  it('token traz identidade, papel e empresas; nunca motorista ou viagem', () => {
    const s = sessionFromClaims(
      {
        name: 'Carlos Andrade',
        email: 'carlos@rotasul.test',
        roles: ['offline_access', 'driver'],
        organization: ['rota-sul'],
      },
      'access-123',
    );
    expect(s).toEqual({
      token: 'access-123',
      name: 'Carlos Andrade',
      company: '',
      email: 'carlos@rotasul.test',
      role: 'driver',
      organizations: ['rota-sul'],
    });
    expect(s.driverId).toBeUndefined();
    expect(s.tripId).toBeUndefined();
  });

  it('agregado em duas transportadoras recebe as duas', () => {
    const s = sessionFromClaims(
      { email: 'joao@rotasul.test', roles: ['driver'], organization: ['translog-demo', 'rota-sul'] },
      't',
    );
    expect(s.organizations).toEqual(['translog-demo', 'rota-sul']);
  });

  it('claim organization em formato de objeto (mapper com atributos) vira lista de aliases', () => {
    const s = sessionFromClaims({ organization: { 'rota-sul': { id: 'x' } } }, 't');
    expect(s.organizations).toEqual(['rota-sul']);
  });

  it('papéis do CCO viram role cco', () => {
    expect(sessionFromClaims({ roles: ['cco-operator'] }, 't').role).toBe('cco');
    expect(sessionFromClaims({ roles: ['cco-operator', 'cco-admin'] }, 't').role).toBe('cco');
  });

  it('motorista e viagem vêm do perfil do backend, casando pelo e-mail', () => {
    const base = sessionFromClaims({ email: 'Marina@RotaSul.test', roles: ['driver'] }, 't');
    const s = withDriverProfile(base, DEFAULT_LOGIN_PROFILES);
    expect(s.driverId).toBe(2);
    expect(s.tripId).toBe('2');
  });

  it('sem perfil de motorista (CCO), a sessão segue sem rota', () => {
    const base = sessionFromClaims({ email: 'cco@rotasul.test', roles: ['cco-operator'] }, 't');
    const s = withDriverProfile(base, DEFAULT_LOGIN_PROFILES);
    expect(s.driverId).toBeUndefined();
    expect(s.tripId).toBeUndefined();
  });
});
