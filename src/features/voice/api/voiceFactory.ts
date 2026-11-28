import type { VoiceMode } from '../../../lib/config';
import { useApiConfig } from '../../../services/api';
import { isLiveKitNativeAvailable, LiveKitVoiceSession } from './livekitVoiceSession';
import { MockVoiceSession } from './mockVoiceSession';
import type { VoiceSession, VoiceSessionCallbacks } from './voiceSession';

export interface VoiceFactoryResult {
  session: VoiceSession;
  activeMode: VoiceMode;
  fallbackReason: string | null;
  errorMessage?: string | null;
}

export function getLiveKitFallbackReason(): string | null {
  if (!isLiveKitNativeAvailable()) return 'livekit_native_unavailable';
  if (useApiConfig.getState().mode !== 'http') return 'livekit_requires_http_api';
  return null;
}

/**
 * Instancia `LiveKitVoiceSession` quando `preferredMode === 'livekit'`, o módulo nativo está
 * disponível e a API está configurada em modo `http`. Se falhar, propaga o erro real sem cair
 * silenciosamente em mock.
 */
export async function createAndStartVoiceSession(
  preferredMode: VoiceMode,
  channel: string,
  callbacks: VoiceSessionCallbacks,
): Promise<VoiceFactoryResult> {
  if (preferredMode === 'livekit') {
    const precheck = getLiveKitFallbackReason();
    if (precheck) {
      const errMsg =
        precheck === 'livekit_requires_http_api'
          ? 'LiveKit requer API em modo Backend (HTTP). Ative o Backend no painel Demo.'
          : 'SDK nativo @livekit/react-native indisponível neste build.';
      callbacks.onModeFallback?.(precheck);
      callbacks.onLiveKitStage?.('error', errMsg);
      callbacks.onError(errMsg);
      return {
        session: new LiveKitVoiceSession(),
        activeMode: 'livekit',
        fallbackReason: precheck,
        errorMessage: errMsg,
      };
    }

    const livekitSession = new LiveKitVoiceSession();
    try {
      await livekitSession.start(channel, callbacks);
      return {
        session: livekitSession,
        activeMode: 'livekit',
        fallbackReason: null,
        errorMessage: null,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const fallbackReason = errorMessage.startsWith('livekit_native_unavailable')
        ? 'livekit_native_unavailable'
        : errorMessage.startsWith('livekit_permission_denied')
          ? 'livekit_permission_denied'
          : null;
      return {
        session: livekitSession,
        activeMode: 'livekit',
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
