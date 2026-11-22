import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path, Rect } from 'react-native-svg';
import { hapticTap } from '../../../utils/haptics';
import { useVoice } from '../hooks/useVoice';
import { VoiceWaveform } from './VoiceWaveform';

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

  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isActive) {
      pulse1.stopAnimation();
      pulse2.stopAnimation();
      pulse1.setValue(0);
      pulse2.setValue(0);
      return;
    }

    const createWave = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const w1 = createWave(pulse1, 0);
    const w2 = createWave(pulse2, 700);
    w1.start();
    w2.start();

    return () => {
      w1.stop();
      w2.stop();
    };
  }, [isActive, pulse1, pulse2]);

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

  const ringColor = isSpeaking ? '#17B26A' : '#099DFD';

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

      <View className="mb-1.5">
        <VoiceWaveform size="md" />
      </View>

      <View className="w-28 h-28 items-center justify-center relative">
        {isActive && (
          <>
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 76,
                height: 76,
                borderRadius: 999,
                backgroundColor: ringColor,
                opacity: pulse1.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.38, 0],
                }),
                transform: [
                  {
                    scale: pulse1.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.55],
                    }),
                  },
                ],
              }}
            />
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 76,
                height: 76,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: ringColor,
                opacity: pulse2.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.55, 0],
                }),
                transform: [
                  {
                    scale: pulse2.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.4],
                    }),
                  },
                ],
              }}
            />
          </>
        )}

        <Pressable
          onPress={() => {
            hapticTap();
            listen();
          }}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={{
            width: 76,
            height: 76,
            shadowColor: ringColor,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isActive ? 0.45 : 0.2,
            shadowRadius: 10,
            elevation: 6,
          }}
          className={`rounded-full items-center justify-center active:opacity-85 ${
            isListening
              ? 'bg-brand-500 border-2 border-brand-50'
              : isSpeaking
                ? 'bg-ok-500 border-2 border-ink-50'
                : 'bg-ink-800 border-2 border-brand-500'
          }`}
        >
          {isSpeaking ? (
            /* Ícone de pausa/barge-in quando o agente está falando */
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <Rect x={6} y={6} width={4.5} height={12} rx={1.5} fill="#0B1220" />
              <Rect x={13.5} y={6} width={4.5} height={12} rx={1.5} fill="#0B1220" />
            </Svg>
          ) : (
            /* Ícone de microfone */
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
                fill={isListening ? '#F4F6FA' : 'none'}
                stroke="#F4F6FA"
                strokeWidth={2}
              />
              <Path
                d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"
                stroke="#F4F6FA"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
        </Pressable>
      </View>

      <Text
        className={`text-xs font-bold uppercase tracking-wider ${
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
