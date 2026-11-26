import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { ENV, KEYCLOAK_SCOPES } from '../../../lib/config';
import type { Session } from '../types';
import { decodeJwtPayload, sessionFromClaims, type RodarClaims } from './claims';

WebBrowser.maybeCompleteAuthSession();

export type KeycloakErrorCode = 'cancelled' | 'unreachable' | 'failed';

export class KeycloakLoginError extends Error {
  constructor(public readonly code: KeycloakErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'KeycloakLoginError';
  }
}

let discoveryCache: AuthSession.DiscoveryDocument | null = null;
let refreshToken: string | null = null;

async function getDiscovery(): Promise<AuthSession.DiscoveryDocument> {
  if (discoveryCache) return discoveryCache;
  try {
    discoveryCache = await AuthSession.fetchDiscoveryAsync(ENV.keycloakIssuer);
    return discoveryCache;
  } catch (err) {
    throw new KeycloakLoginError('unreachable', err instanceof Error ? err.message : undefined);
  }
}

/** avisai://oauthredirect no dev client; exp://<ip>:8081/--/oauthredirect no Expo Go. */
export function keycloakRedirectUri(): string {
  return AuthSession.makeRedirectUri({ scheme: 'avisai', path: 'oauthredirect' });
}

/** Authorization Code + PKCE no navegador do sistema. `loginHint` pré-preenche o usuário. */
export async function keycloakLogin(loginHint?: string): Promise<Session> {
  const discovery = await getDiscovery();
  const redirectUri = keycloakRedirectUri();
  const request = new AuthSession.AuthRequest({
    clientId: ENV.keycloakClientId,
    scopes: [...KEYCLOAK_SCOPES],
    redirectUri,
    usePKCE: true,
    responseType: AuthSession.ResponseType.Code,
    extraParams: loginHint ? { login_hint: loginHint } : undefined,
  });

  const result = await request.promptAsync(discovery);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new KeycloakLoginError('cancelled');
  }
  if (result.type !== 'success' || !result.params.code) {
    throw new KeycloakLoginError('failed', result.type === 'error' ? result.error?.message : result.type);
  }

  try {
    const tokens = await AuthSession.exchangeCodeAsync(
      {
        clientId: ENV.keycloakClientId,
        code: result.params.code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier ?? '' },
      },
      discovery,
    );
    if (!tokens.idToken) throw new Error('missing_id_token');
    refreshToken = tokens.refreshToken ?? null;
    return sessionFromClaims(decodeJwtPayload<RodarClaims>(tokens.idToken), tokens.accessToken);
  } catch (err) {
    throw new KeycloakLoginError('failed', err instanceof Error ? err.message : undefined);
  }
}

/** Revoga o refresh token (encerra a sessão offline no Keycloak). Melhor esforço. */
export async function keycloakLogout(): Promise<void> {
  const token = refreshToken;
  refreshToken = null;
  if (!token) return;
  try {
    await AuthSession.revokeAsync(
      { token, clientId: ENV.keycloakClientId, tokenTypeHint: AuthSession.TokenTypeHint.RefreshToken },
      await getDiscovery(),
    );
  } catch {
    // sem rede: o token expira sozinho
  }
}
