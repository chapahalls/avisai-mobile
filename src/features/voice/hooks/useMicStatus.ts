import { useTranslation } from 'react-i18next';
import { useVoice } from './useVoice';

/**
 * Rótulo e dica do botão de voz, iguais em todo lugar (esfera flutuante, painel, tela cheia).
 * Toque com o agente falando = interromper (barge-in); na Agora, toque alterna o mudo.
 */
export function useMicStatus() {
  const { t } = useTranslation();
  const state = useVoice((s) => s.state);
  const preferredMode = useVoice((s) => s.preferredMode);
  const activeMode = useVoice((s) => s.activeMode);
  const agoraStage = useVoice((s) => s.agoraStage);
  const sessionConnected = useVoice((s) => s.sessionConnected);
  const muted = useVoice((s) => s.muted);

  const isListening = state === 'listening' && !muted;
  const isSpeaking = state === 'speaking';
  const isAgoraConnected = activeMode === 'agora' && sessionConnected;
  const isAgoraConnecting = preferredMode === 'agora' && agoraStage === 'connecting';
  const isAgoraWaitingAgent = preferredMode === 'agora' && agoraStage === 'waiting_agent';
  const isAgoraNeedsConnect =
    preferredMode === 'agora' && !sessionConnected && !isAgoraConnecting && !isAgoraWaitingAgent;
  /** Modo de voz direta: o motorista fala de verdade, sem falas simuladas. */
  const directVoice = preferredMode === 'agora' || activeMode === 'agora';

  const label = isSpeaking
    ? t('voice.interrupt')
    : isAgoraConnecting
      ? t('voice.agoraConnecting')
      : isAgoraWaitingAgent
        ? t('voice.agoraWaitingAgent')
        : isAgoraNeedsConnect
          ? t('voice.connectAgora')
          : isAgoraConnected && muted
            ? t('voice.muted')
            : isListening
              ? t('voice.listening')
              : t('voice.talk');

  const hint = isSpeaking
    ? t('voice.bargeInHint')
    : isAgoraConnecting
      ? t('voice.agoraConnectingHint')
      : isAgoraWaitingAgent
        ? t('voice.agoraWaitingAgentHint')
        : isAgoraNeedsConnect
          ? t('voice.connectAgoraHint')
          : isAgoraConnected
            ? muted
              ? t('voice.unmuteHint')
              : t('voice.agoraLiveHint')
            : isListening
              ? t('voice.selectQuickHint')
              : t('voice.tapToSpeakHint');

  return {
    label,
    hint,
    isListening,
    isSpeaking,
    isActive: isListening || isSpeaking,
    isBusy: isAgoraConnecting || isAgoraWaitingAgent,
    isAgoraConnected,
    directVoice,
  };
}
