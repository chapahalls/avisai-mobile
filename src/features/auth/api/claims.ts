import type { Session } from '../types';

/** Claims que o realm `avisai` coloca no ID token (ver rodarglobal/rodar-keycloak). */
export interface AvisaiClaims {
  sub?: string;
  name?: string;
  given_name?: string;
  email?: string;
  preferred_username?: string;
  driver_id?: number | string;
  trip_id?: string | number;
  plate?: string;
  company?: string;
  roles?: string[];
}

/** Lê o payload de um JWT sem validar assinatura (o token veio direto do endpoint de token). */
export function decodeJwtPayload<T = Record<string, unknown>>(jwt: string): T {
  const part = jwt.split('.')[1];
  if (!part) throw new Error('invalid_jwt');
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4);
  const binary = atob(b64);
  const utf8 = decodeURIComponent(
    Array.from(binary, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
  );
  return JSON.parse(utf8) as T;
}

/** Converte as claims do Keycloak na `Session` que o resto do app já usa. */
export function sessionFromClaims(claims: AvisaiClaims, accessToken: string): Session {
  const driverId = Number(claims.driver_id);
  const roles = claims.roles ?? [];
  return {
    token: accessToken,
    name: claims.name || claims.given_name || claims.email || claims.preferred_username || '',
    company: claims.company || '',
    email: claims.email ?? claims.preferred_username,
    driverId: Number.isFinite(driverId) && driverId > 0 ? driverId : undefined,
    tripId: claims.trip_id !== undefined && claims.trip_id !== '' ? String(claims.trip_id) : undefined,
    role: roles.includes('driver') ? 'driver' : roles.includes('cco') ? 'cco' : roles[0],
  };
}
