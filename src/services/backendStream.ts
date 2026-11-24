import { create } from 'zustand';
import { useTrip } from '../features/trip/hooks/useTrip';
import { useVoice } from '../features/voice/hooks/useVoice';
import type { EventoStream, MensagensStream } from '../types/backend';
import { useApiConfig } from './api';
import { executeClientAction } from './voiceCommands';

export type WsConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface BackendStreamState {
  status: WsConnectionStatus;
  eventos: EventoStream[];
  lastError: string | null;
}

const MAX_EVENTOS = 50;

export const useBackendStream = create<BackendStreamState>(() => ({
  status: 'disconnected',
  eventos: [],
  lastError: null,
}));

type StreamEnvelope = {
  [K in keyof MensagensStream]: { canal: K; dado: MensagensStream[K] };
}[keyof MensagensStream];

export function buildBackendWebSocketUrl(
  baseUrl: string,
  rotaId: number,
  driverId: number | null,
): string | null {
  try {
    const url = new URL(baseUrl.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/ws`;
    url.search = driverId !== null ? `motorista_id=${driverId}` : `rota_id=${rotaId}`;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function handleStreamMessage(raw: string) {
  let parsed: StreamEnvelope;
  try {
    parsed = JSON.parse(raw) as StreamEnvelope;
  } catch {
    return;
  }
  if (!parsed || typeof parsed !== 'object' || !('canal' in parsed)) return;

  const { canal, dado } = parsed;
  switch (canal) {
    case 'snapshot': {
      useBackendStream.setState({
        eventos: Array.isArray(dado.eventos) ? dado.eventos.slice(0, MAX_EVENTOS) : [],
      });
      useTrip.getState().applyBackendSnapshot(dado);
      break;
    }
    case 'posicao': {
      useTrip.getState().applyBackendPosicao(dado);
      break;
    }
    case 'contador': {
      if (Array.isArray(dado.estadias)) {
        useTrip.getState().applyBackendContador(dado.estadias);
      }
      break;
    }
    case 'task': {
      if (dado?.task) {
        useTrip.getState().applyBackendTask(dado.task);
      }
      break;
    }
    case 'fala': {
      // `fala` é evidência de backend; a transcrição do motorista/agente já é
      // recebida pelo canal de voz ou pelo evento persistido. Não duplicar no chat.
      break;
    }
    case 'chamado': {
      const chamado = dado?.chamado;
      if (chamado?.resposta) {
        useVoice.getState().pushTranscript('agent', chamado.resposta);
      } else if (chamado?.status === 'timeout') {
        useVoice.getState().pushTranscript('agent', 'Não recebi resposta do CCO após cinco tentativas.');
      }
      break;
    }
    case 'acao_cliente': {
      if (dado?.acao) {
        executeClientAction(dado.acao, { tela: dado.tela, documento: dado.documento });
      }
      break;
    }
    case 'evento': {
      useBackendStream.setState((s) => ({
        eventos: [dado, ...s.eventos].slice(0, MAX_EVENTOS),
      }));
      useTrip.getState().applyBackendEvento(dado);
      break;
    }
    case 'reset': {
      useBackendStream.setState({ eventos: [] });
      useTrip.getState().applyBackendReset();
      break;
    }
  }
}

/**
 * Gerencia a conexão WebSocket em tempo real com `/ws?motorista_id={driverId}` (ou fallback `/ws?rota_id={rotaId}`).
 * Conecta automaticamente quando `useApiConfig.mode === 'http'` e reconecta após 2 s em caso de queda.
 */
export function startBackendStreamWatcher(): () => void {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let alive = true;
  let activeUrl = '';

  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const disconnect = () => {
    clearReconnect();
    activeUrl = '';
    if (ws) {
      const current = ws;
      ws = null;
      current.onopen = null;
      current.onmessage = null;
      current.onerror = null;
      current.onclose = null;
      try {
        current.close();
      } catch {
        // Ignora erro ao fechar socket
      }
    }
    useBackendStream.setState({ status: 'disconnected' });
  };

  const connect = () => {
    clearReconnect();
    if (!alive) return;

    const { mode, baseUrl, rotaId, driverId } = useApiConfig.getState();
    if (mode !== 'http' || typeof WebSocket === 'undefined') {
      disconnect();
      return;
    }

    const wsUrl = buildBackendWebSocketUrl(baseUrl, rotaId, driverId);
    if (!wsUrl) {
      disconnect();
      useBackendStream.setState({ lastError: 'invalid_ws_url' });
      return;
    }

    if (ws && activeUrl === wsUrl) {
      return;
    }

    if (ws) {
      disconnect();
    }

    activeUrl = wsUrl;
    useBackendStream.setState({ status: 'connecting', lastError: null });

    try {
      const socket = new WebSocket(wsUrl);
      ws = socket;

      socket.onopen = () => {
        if (ws !== socket) return;
        useBackendStream.setState({ status: 'connected', lastError: null });
      };

      socket.onmessage = (event) => {
        if (ws !== socket) return;
        handleStreamMessage(String(event.data));
      };

      socket.onerror = () => {
        if (ws !== socket) return;
        useBackendStream.setState({ lastError: 'ws_error' });
      };

      socket.onclose = () => {
        if (ws !== socket) return;
        ws = null;
        activeUrl = '';
        useBackendStream.setState({ status: 'disconnected' });
        if (alive && useApiConfig.getState().mode === 'http') {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    } catch (err) {
      ws = null;
      activeUrl = '';
      useBackendStream.setState({
        status: 'disconnected',
        lastError: err instanceof Error ? err.message : 'ws_connect_failed',
      });
      if (alive && useApiConfig.getState().mode === 'http') {
        reconnectTimer = setTimeout(connect, 2000);
      }
    }
  };

  connect();

  const unsubscribe = useApiConfig.subscribe((state, prevState) => {
    if (
      state.mode !== prevState.mode ||
      state.baseUrl !== prevState.baseUrl ||
      state.rotaId !== prevState.rotaId ||
      state.driverId !== prevState.driverId
    ) {
      connect();
    }
  });

  return () => {
    alive = false;
    unsubscribe();
    disconnect();
  };
}
