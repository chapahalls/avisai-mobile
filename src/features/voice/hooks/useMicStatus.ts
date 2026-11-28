import { useTranslation } from 'react-i18next';
import { useVoice } from './useVoice';

/**
 * Rótulo e dica do botão de voz, iguais em todo lugar (esfera flutuante, painel, tela cheia).
 * Toque com o agente falando = interromper (barge-in); no LiveKit, toque alterna o mudo.
 */
export function useMicStatus() {
  const { t } = useTranslation();
  const state = useVoice((s) => s.state);
  const preferredMode = useVoice((s) => s.preferredMode);
  const activeMode = useVoice((s) => s.activeMode);
  const liveKitStage = useVoice((s) => s.liveKitStage);
  const sessionConnected = useVoice((s) => s.sessionConnected);
  const offlineRecordingActive = useVoice((s) => s.offlineRecordingActive);
  const muted = useVoice((s) => s.muted);

  const isListening = state === 'listening' && !muted;
  const isSpeaking = state === 'speaking';
  const isLiveKitConnected = activeMode === 'livekit' && sessionConnected;
  const isLiveKitConnecting = preferredMode === 'livekit' && liveKitStage === 'connecting';
  const isLiveKitWaitingAgent = preferredMode === 'livekit' && liveKitStage === 'waiting_agent';
  const isLiveKitNeedsConnect =
    preferredMode === 'livekit' &&
    !sessionConnected &&
    !offlineRecordingActive &&
    !isLiveKitConnecting &&
    !isLiveKitWaitingAgent;
  /** Modo de voz direta: o motorista fala de verdade, sem falas simuladas. */
  const directVoice = !offlineRecordingActive && (preferredMode === 'livekit' || activeMode === 'livekit');

  const label = isSpeaking
    ? t('voice.interrupt')
    : isLiveKitConnecting
      ? t('voice.liveKitConnecting')
      : isLiveKitWaitingAgent
        ? t('voice.liveKitWaitingAgent')
        : isLiveKitNeedsConnect
          ? t('voice.connectLiveKit')
          : isLiveKitConnected && muted
            ? t('voice.muted')
            : isListening
              ? t('voice.listening')
              : t('voice.talk');

  const hint = isSpeaking
    ? t('voice.bargeInHint')
    : isLiveKitConnecting
      ? t('voice.liveKitConnectingHint')
      : isLiveKitWaitingAgent
        ? t('voice.liveKitWaitingAgentHint')
        : isLiveKitNeedsConnect
          ? t('voice.connectLiveKitHint')
          : isLiveKitConnected
            ? muted
              ? t('voice.unmuteHint')
              : t('voice.liveKitLiveHint')
            : isListening
              ? t('voice.selectQuickHint')
              : t('voice.tapToSpeakHint');

  return {
    label,
    hint,
    isListening,
    isSpeaking,
    isActive: isListening || isSpeaking,
    isBusy: isLiveKitConnecting || isLiveKitWaitingAgent,
    isLiveKitConnected,
    directVoice,
  };
}
