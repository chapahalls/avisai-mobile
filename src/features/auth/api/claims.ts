import type { LoginProfileOption, Session } from '../types';

/**
 * Claims do realm `rodar` (rodarglobal/rodar-keycloak, docs/adr/0001): só identidade, papéis e empresas.
 * Motorista, viagem e veículo não vêm no token: o app resolve pelo backend a partir do e-mail.
 */
export interface RodarClaims {
  sub?: string;
  name?: string;
  given_name?: string;
  email?: string;
  preferred_username?: string;
  roles?: string[];
  /** Aliases das Organizations (transportadoras) da pessoa; vem com o escopo `organization:*`. */
  organization?: string[] | Record<string, unknown>;
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

/** A claim `organization` é lista de aliases, ou objeto por alias quando o mapper inclui atributos. */
function organizationsFrom(claim: RodarClaims['organization']): string[] {
  if (Array.isArray(claim)) return claim.filter((o): o is string => typeof o === 'string');
  if (claim && typeof claim === 'object') return Object.keys(claim);
  return [];
}

function roleFrom(roles: string[]): string | undefined {
  if (roles.includes('driver')) return 'driver';
  if (roles.includes('cco-operator') || roles.includes('cco-admin')) return 'cco';
  return undefined;
}

/** Converte as claims do Keycloak na `Session` que o resto do app já usa. */
export function sessionFromClaims(claims: RodarClaims, accessToken: string): Session {
  return {
    token: accessToken,
    name: claims.name || claims.given_name || claims.email || claims.preferred_username || '',
    company: '',
    email: claims.email ?? claims.preferred_username,
    role: roleFrom(claims.roles ?? []),
    organizations: organizationsFrom(claims.organization),
  };
}

/**
 * Completa a sessão do Keycloak com motorista e viagem do backend (`GET /api/users`, ou perfis de demo),
 * casando pelo e-mail. Sem perfil de motorista, a sessão segue sem rota.
 */
export function withDriverProfile(session: Session, profiles: LoginProfileOption[]): Session {
  const email = session.email?.trim().toLowerCase();
  const profile = email ? profiles.find((p) => p.email.trim().toLowerCase() === email) : undefined;
  if (!profile) return session;
  return {
    ...session,
    name: session.name || profile.name,
    driverId: profile.driverId ?? undefined,
    tripId: profile.tripId ?? undefined,
  };
}
