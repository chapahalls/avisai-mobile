import type { VoiceMode } from '../../../lib/config';
import { useApiConfig } from '../../../services/api';
import { AgoraVoiceSession, isAgoraNativeAvailable } from './agoraVoiceSession';
import { MockVoiceSession } from './mockVoiceSession';
import type { VoiceSession, VoiceSessionCallbacks } from './voiceSession';

export interface VoiceFactoryResult {
  session: VoiceSession;
  activeMode: VoiceMode;
  fallbackReason: string | null;
  errorMessage?: string | null;
}

export function getAgoraFallbackReason(): string | null {
  if (!isAgoraNativeAvailable()) return 'agora_native_unavailable';
  if (useApiConfig.getState().mode !== 'http') return 'agora_requires_http_api';
  return null;
}

/**
 * Instancia `AgoraVoiceSession` quando `preferredMode === 'agora'`, o módulo nativo está disponível
 * e a API está configurada em modo `http`. Se falhar, propaga o erro real sem cair silenciosamente em mock.
 */
export async function createAndStartVoiceSession(
  preferredMode: VoiceMode,
  channel: string,
  callbacks: VoiceSessionCallbacks,
): Promise<VoiceFactoryResult> {
  if (preferredMode === 'agora') {
    const precheck = getAgoraFallbackReason();
    if (precheck) {
      const errMsg =
        precheck === 'agora_requires_http_api'
          ? 'Agora requer API em modo Backend (HTTP). Ative o Backend no painel Demo.'
          : 'SDK nativo react-native-agora indisponível neste build.';
      callbacks.onModeFallback?.(precheck);
      callbacks.onAgoraStage?.('error', errMsg);
      callbacks.onError(errMsg);
      return {
        session: new AgoraVoiceSession(),
        activeMode: 'agora',
        fallbackReason: precheck,
        errorMessage: errMsg,
      };
    }

    const agoraSession = new AgoraVoiceSession();
    try {
      await agoraSession.start(channel, callbacks);
      return {
        session: agoraSession,
        activeMode: 'agora',
        fallbackReason: null,
        errorMessage: null,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const fallbackReason = errorMessage.startsWith('agora_native_unavailable')
        ? 'agora_native_unavailable'
        : errorMessage.startsWith('agora_permission_denied')
          ? 'agora_permission_denied'
          : null;
      return {
        session: agoraSession,
        activeMode: 'agora',
        fallbackReason,
        errorMessage,
      };
    }
  }

  const mockSession = new MockVoiceSession();
  await mockSession.start(channel, callbacks);
  return {
    session: mockSession,
    activeMode: 'mock',
    fallbackReason: null,
    errorMessage: null,
  };
}
