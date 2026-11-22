import { ENV } from '../lib/config';
import type {
  ApiDocumentResponse,
  ApiRouteResponse,
  DemoProfile,
  Ligacao,
  PosicaoOut,
  Rota,
  Sessao,
  Snapshot,
  SolicitacaoCentral,
  SsoBackendResponse,
} from '../types/backend';
import type { DomainEvent } from '../types/events';
import { useApiConfig } from './api';
import {
  NetworkError,
  type ApiClient,
  type CallReceiverParams,
  type HealthCheckResult,
  type ReceiverAnswer,
  type SendPositionBody,
  type Session,
  type VoiceTokenParams,
  type VoiceTokenResponse,
} from './apiClient';
import { mockApiClient, ssoLogin as mockSsoLogin } from './mockApi';
import { useNetwork } from './network';

const TIMEOUT_MS = 8000;

function getBaseUrl(): string {
  try {
    return (useApiConfig.getState().baseUrl || ENV.apiBaseUrl).replace(/\/+$/, '');
  } catch {
    return ENV.apiBaseUrl;
  }
}

function getRotaId(): number {
  try {
    return useApiConfig.getState().rotaId || ENV.rotaId;
  } catch {
    return ENV.rotaId;
  }
}

async function fetchWithTimeout(
  path: string,
  init: RequestInit = {},
  timeoutMs = TIMEOUT_MS,
): Promise<Response> {
  if (useNetwork.getState().quality() === 'offline') {
    throw new NetworkError('offline');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${getBaseUrl()}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
    return res;
  } catch (err) {
    throw new NetworkError(err instanceof Error ? err.message : 'fetch_failed');
  } finally {
    clearTimeout(timer);
  }
}

export const httpApiClient: ApiClient = {
  async checkHealth(): Promise<HealthCheckResult> {
    try {
      const res = await fetchWithTimeout('/health', { method: 'GET' });
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}` };
      }
      const data = (await res.json()) as {
        ok?: boolean;
        public_url?: string | null;
        agora_configurada?: boolean;
        llm_mode?: string | null;
        llm_upstream?: boolean;
        recebedor_modo?: string | null;
      };
      return {
        ok: Boolean(data.ok),
        publicUrl: data.public_url ?? undefined,
        agoraConfigured:
          typeof data.agora_configurada === 'boolean' ? data.agora_configurada : undefined,
        llmMode: data.llm_mode ?? undefined,
        llmUpstream: typeof data.llm_upstream === 'boolean' ? data.llm_upstream : undefined,
        receiverMode: data.recebedor_modo ?? undefined,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'unreachable',
      };
    }
  },

  async createSession(rotaId = getRotaId()): Promise<Sessao> {
    const res = await fetchWithTimeout(
      '/sessions',
      {
        method: 'POST',
        body: JSON.stringify({ rota_id: rotaId }),
      },
      20000,
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new NetworkError(`HTTP ${res.status}: ${txt}`);
    }
    return (await res.json()) as Sessao;
  },

  async deleteSession(sessionId: number): Promise<void> {
    const res = await fetchWithTimeout(`/sessions/${sessionId}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 404) {
      throw new NetworkError(`HTTP ${res.status}`);
    }
  },

  async getVoiceToken(params: VoiceTokenParams): Promise<VoiceTokenResponse> {
    const res = await fetchWithTimeout(
      `/token?channel=${encodeURIComponent(params.channel)}&uid=${params.uid}`,
      { method: 'GET' },
    );
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
    return (await res.json()) as VoiceTokenResponse;
  },

  async speak(
    sessionId: number,
    texto: string,
    prioridade: 'APPEND' | 'INTERRUPT' = 'APPEND',
  ): Promise<void> {
    const res = await fetchWithTimeout(`/sessions/${sessionId}/speak`, {
      method: 'POST',
      body: JSON.stringify({ texto, prioridade }),
    });
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
  },

  async getRoute(rotaId = getRotaId()): Promise<Rota | null> {
    const res = await fetchWithTimeout(`/rotas/${rotaId}`, { method: 'GET' });
    if (res.status === 404) return null;
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
    return (await res.json()) as Rota;
  },

  async getAssignedRoute(params?: {
    tripId?: string;
    driverId?: number;
  }): Promise<ApiRouteResponse | null> {
    const driverId = params?.driverId ?? useApiConfig.getState().driverId ?? undefined;
    const tripId = params?.tripId;

    if (tripId) {
      const res = await fetchWithTimeout(
        `/api/route?tripId=${encodeURIComponent(tripId)}`,
        { method: 'GET' },
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
      return (await res.json()) as ApiRouteResponse;
    }

    if (driverId !== undefined) {
      const res = await fetchWithTimeout(
        `/api/route?driverId=${encodeURIComponent(String(driverId))}`,
        { method: 'GET' },
      );
      if (res.ok) {
        return (await res.json()) as ApiRouteResponse;
      }
      if (res.status !== 404) {
        throw new NetworkError(`HTTP ${res.status}`);
      }
    }

    const fallbackRes = await fetchWithTimeout(
      `/api/route?tripId=${encodeURIComponent(String(getRotaId()))}`,
      { method: 'GET' },
    );
    if (fallbackRes.status === 404) return null;
    if (!fallbackRes.ok) throw new NetworkError(`HTTP ${fallbackRes.status}`);
    return (await fallbackRes.json()) as ApiRouteResponse;
  },

  async getDocuments(tripId?: string): Promise<ApiDocumentResponse[]> {
    const targetTripId = tripId ?? String(getRotaId());
    const res = await fetchWithTimeout(
      `/api/documents?tripId=${encodeURIComponent(targetTripId)}`,
      { method: 'GET' },
    );
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
    return (await res.json()) as ApiDocumentResponse[];
  },

  async getCentralRequests(rotaId = getRotaId()): Promise<SolicitacaoCentral[]> {
    const res = await fetchWithTimeout(`/rotas/${rotaId}/solicitacoes`, {
      method: 'GET',
    });
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
    return (await res.json()) as SolicitacaoCentral[];
  },

  async sendPosition(rotaId: number, body: SendPositionBody): Promise<PosicaoOut> {
    const res = await fetchWithTimeout(`/rotas/${rotaId}/posicao`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
    return (await res.json()) as PosicaoOut;
  },

  async registerArrival(rotaId = getRotaId()): Promise<void> {
    const res = await fetchWithTimeout(`/rotas/${rotaId}/chegada`, {
      method: 'POST',
    });
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
  },

  async confirmUnload(rotaId = getRotaId(), por = 'motorista'): Promise<void> {
    const res = await fetchWithTimeout(`/rotas/${rotaId}/descarga`, {
      method: 'POST',
      body: JSON.stringify({ por }),
    });
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
  },

  async callReceiver(params: CallReceiverParams): Promise<ReceiverAnswer> {
    const rotaId = params.rotaId ?? getRotaId();
    const motivo = params.attempt === 'approach' ? 'aproximacao' : 'cco_sem_resposta';
    const res = await fetchWithTimeout(`/rotas/${rotaId}/ligar-recebedor`, {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    });
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
    const data = (await res.json()) as Ligacao | ReceiverAnswer;
    if ('kind' in data) {
      return data;
    }
    if (data.status === 'respondida') {
      return {
        kind: 'confirmed',
        dock: data.doca || '1',
        time: data.previsao || data.resposta_resumo || 'confirmado',
      };
    }
    if (data.status === 'em_andamento' || data.status === 'chamando') {
      return { kind: 'calling' };
    }
    return { kind: 'no_answer' };
  },

  async resetRoute(rotaId = getRotaId()): Promise<void> {
    const res = await fetchWithTimeout(`/rotas/${rotaId}/reset`, {
      method: 'POST',
    });
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
  },

  async getSnapshot(rotaId = getRotaId()): Promise<Snapshot> {
    const res = await fetchWithTimeout(`/cco/estado?rota_id=${rotaId}`, {
      method: 'GET',
    });
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
    return (await res.json()) as Snapshot;
  },

  async postEvent(event: DomainEvent): Promise<{ status: 200 | 409; receivedAt: string }> {
    const rotaId = getRotaId();
    const res = await fetchWithTimeout('/events', {
      method: 'POST',
      body: JSON.stringify({
        id: event.id,
        idempotencyKey: event.idempotencyKey,
        tripId: String(rotaId),
        type: event.type,
        occurredAt: event.occurredAt,
        source: event.source,
        payload: event.payload,
      }),
    });

    if (res.status === 409) {
      const dup = (await res.json().catch(() => ({}))) as { receivedAt?: string };
      return {
        status: 409,
        receivedAt: dup.receivedAt ?? new Date().toISOString(),
      };
    }

    if (!res.ok) {
      throw new NetworkError(`HTTP ${res.status}`);
    }

    const data = (await res.json().catch(() => ({}))) as { receivedAt?: string };

    if (event.type === 'ApproachDetected') {
      const lat = typeof event.payload?.lat === 'number' ? event.payload.lat : undefined;
      const lng = typeof event.payload?.lng === 'number' ? event.payload.lng : undefined;
      if (lat !== undefined && lng !== undefined) {
        await this.sendPosition(rotaId, { lat, lng, fonte: 'celular' }).catch(() => undefined);
      }
    }

    return {
      status: 200,
      receivedAt: data.receivedAt ?? new Date().toISOString(),
    };
  },

  async getEvents(tripId: string): Promise<DomainEvent[]> {
    const res = await fetchWithTimeout(
      `/events?tripId=${encodeURIComponent(tripId)}`,
      { method: 'GET' },
    );
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
    return (await res.json()) as DomainEvent[];
  },

  async getDemoProfiles(role?: 'cco' | 'driver'): Promise<DemoProfile[]> {
    try {
      const query = role ? `?role=${encodeURIComponent(role)}` : '';
      const res = await fetchWithTimeout(`/api/users${query}`, { method: 'GET' });
      if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
      const data = (await res.json()) as DemoProfile[];
      return Array.isArray(data) ? data : mockApiClient.getDemoProfiles(role);
    } catch {
      return mockApiClient.getDemoProfiles(role);
    }
  },

  async ssoLogin(email?: string): Promise<Session> {
    try {
      const res = await fetchWithTimeout('/auth/sso', {
        method: 'POST',
        body: JSON.stringify(email ? { email } : {}),
      });
      if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
      const data = (await res.json()) as SsoBackendResponse;
      if (data.user?.driverId !== undefined) {
        useApiConfig.getState().setDriverId(data.user.driverId);
      }
      if (data.user?.tripId) {
        const parsedRotaId = Number(String(data.user.tripId).replace(/^rota-|^trip-/, ''));
        if (Number.isFinite(parsedRotaId) && parsedRotaId > 0) {
          useApiConfig.getState().setRotaId(parsedRotaId);
        }
      } else if (data.user?.driverId) {
        useApiConfig.getState().setRotaId(data.user.driverId);
      }
      return {
        token: data.token,
        name: data.user?.name || 'Carlos Andrade',
        company: 'Transportadora Rota Sul',
        email: data.user?.email,
        driverId: data.user?.driverId ?? undefined,
        tripId: data.user?.tripId ?? undefined,
        role: data.user?.role,
      };
    } catch {
      return mockSsoLogin(email);
    }
  },
};
