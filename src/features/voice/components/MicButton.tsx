import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { hapticTap } from '../../../utils/haptics';
import { useVoice } from '../hooks/useVoice';
import { AuroraVoiceOrb } from './AuroraVoiceOrb';

/** Toque com o agente falando = barge-in (interrompe na hora). Toque quando ouvindo = volta a idle (ou alterna mudo na Agora). */
export function MicButton() {
  const { t } = useTranslation();
  const state = useVoice((s) => s.state);
  const preferredMode = useVoice((s) => s.preferredMode);
  const activeMode = useVoice((s) => s.activeMode);
  const agoraStage = useVoice((s) => s.agoraStage);
  const sessionConnected = useVoice((s) => s.sessionConnected);
  const muted = useVoice((s) => s.muted);
  const bargeInBanner = useVoice((s) => s.bargeInBanner);
  const audioLevel = useVoice((s) => s.audioLevel);
  const audioSpeaker = useVoice((s) => s.audioSpeaker);
  const listen = useVoice((s) => s.listen);
  const toggleMute = useVoice((s) => s.toggleMute);
  const stop = useVoice((s) => s.stop);

  const isListening = state === 'listening' && !muted;
  const isSpeaking = state === 'speaking';
  const isActive = isListening || isSpeaking;
  const isAgoraConnected = activeMode === 'agora' && sessionConnected;
  const isAgoraConnecting = preferredMode === 'agora' && agoraStage === 'connecting';
  const isAgoraWaitingAgent = preferredMode === 'agora' && agoraStage === 'waiting_agent';
  const isAgoraNeedsConnect =
    preferredMode === 'agora' && !sessionConnected && !isAgoraConnecting && !isAgoraWaitingAgent;

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

  const subHint = isSpeaking
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

  return (
    <View className="items-center w-full">
      {bargeInBanner && (
        <View
          accessibilityRole="alert"
          className="mb-2.5 bg-wait-500/20 border border-wait-500/80 rounded-full px-3.5 py-1.5 flex-row items-center gap-1.5"
        >
          <Text className="text-wait-500 text-xs font-bold">
            {t('voice.bargeInBanner')}
          </Text>
        </View>
      )}

      <View className="w-36 h-36 items-center justify-center">
        <Pressable
          onPress={() => {
            hapticTap();
            listen();
          }}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={subHint}
          accessibilityState={{
            busy: isAgoraConnecting || isAgoraWaitingAgent,
            selected: isActive,
          }}
          style={{
            width: 132,
            height: 132,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="rounded-full active:opacity-85"
        >
          <AuroraVoiceOrb
            state={state}
            muted={muted}
            audioLevel={audioLevel}
            audioSpeaker={audioSpeaker}
            size={124}
          />
        </Pressable>
      </View>

      <Text
        className={`text-sm font-semibold ${
          isSpeaking ? 'text-ok-500' : isListening ? 'text-brand-500' : 'text-ink-50'
        }`}
      >
        {label}
      </Text>
      <Text className="text-ink-300 text-[11px] mt-0.5 text-center">{subHint}</Text>

      {isAgoraConnected && (
        <View className="flex-row items-center gap-2.5 mt-3">
          <Pressable
            onPress={() => {
              hapticTap();
              toggleMute();
            }}
            accessibilityRole="button"
            className={`px-3.5 py-1.5 rounded-full border active:opacity-80 ${
              muted
                ? 'bg-wait-500/20 border-wait-500'
                : 'bg-ink-800 border-ink-700'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                muted ? 'text-wait-500' : 'text-ink-50'
              }`}
            >
              {muted ? t('voice.unmuteButton') : t('voice.muteButton')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              hapticTap();
              stop();
            }}
            accessibilityRole="button"
            className="px-3.5 py-1.5 rounded-full border border-alert-500/70 bg-alert-500/15 active:opacity-80"
          >
            <Text className="text-alert-500 text-xs font-semibold">
              {t('voice.endSessionButton')}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
