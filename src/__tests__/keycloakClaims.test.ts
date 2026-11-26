import { describe, expect, it } from 'vitest';
import { decodeJwtPayload, sessionFromClaims } from '../features/auth/api/claims';

function fakeJwt(payload: object): string {
  const b64url = (s: string) =>
    Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url('{"alg":"none"}')}.${b64url(JSON.stringify(payload))}.sig`;
}

describe('Keycloak claims', () => {
  it('decodifica payload UTF-8 (João)', () => {
    const claims = decodeJwtPayload<{ name: string }>(fakeJwt({ name: 'João Pereira' }));
    expect(claims.name).toBe('João Pereira');
  });

  it('mapeia claims do realm avisai para Session', () => {
    const s = sessionFromClaims(
      {
        name: 'Carlos Andrade',
        email: 'carlos@rotasul.test',
        driver_id: 1,
        trip_id: '1',
        company: 'RotaSul Transportes',
        roles: ['offline_access', 'driver'],
      },
      'access-123',
    );
    expect(s).toEqual({
      token: 'access-123',
      name: 'Carlos Andrade',
      company: 'RotaSul Transportes',
      email: 'carlos@rotasul.test',
      driverId: 1,
      tripId: '1',
      role: 'driver',
    });
  });

  it('usuário CCO sem driver_id não ganha motorista nem rota', () => {
    const s = sessionFromClaims({ email: 'cco@rotasul.test', roles: ['cco'] }, 't');
    expect(s.driverId).toBeUndefined();
    expect(s.tripId).toBeUndefined();
    expect(s.role).toBe('cco');
    expect(s.name).toBe('cco@rotasul.test');
  });
});
