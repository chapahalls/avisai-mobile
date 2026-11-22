import { Modal, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { hapticTap } from '../../../utils/haptics';
import { useVoice } from '../hooks/useVoice';
import { VoiceStateIndicator } from './VoiceStateIndicator';
import { VoiceWaveform } from './VoiceWaveform';

export interface CabinModeModalProps {
  visible: boolean;
  onClose: () => void;
  stayTimer?: string | null;
  stayValue?: string | null;
  stayOver?: boolean;
}

/**
 * Modo Cabine / Mãos-Livres (B1 + C1):
 * Tela cheia de alto contraste com última fala em fonte gigante, waveform ampliado,
 * rota de áudio (Viva-voz / Bluetooth / Fone) e botão de microfone de 128×128 px.
 */
export function CabinModeModal({
  visible,
  onClose,
  stayTimer,
  stayValue,
  stayOver = false,
}: CabinModeModalProps) {
  const { t } = useTranslation();
  const state = useVoice((s) => s.state);
  const transcript = useVoice((s) => s.transcript);
  const liveTranscript = useVoice((s) => s.liveTranscript);
  const preferredMode = useVoice((s) => s.preferredMode);
  const agoraStage = useVoice((s) => s.agoraStage);
  const sessionConnected = useVoice((s) => s.sessionConnected);
  const muted = useVoice((s) => s.muted);
  const audioRoute = useVoice((s) => s.audioRoute);
  const bargeInBanner = useVoice((s) => s.bargeInBanner);
  const listen = useVoice((s) => s.listen);
  const toggleMute = useVoice((s) => s.toggleMute);

  const isListening = state === 'listening' && !muted;
  const isSpeaking = state === 'speaking';

  const lastAgentLine = [...transcript].reverse().find((l) => l.who === 'agent');
  const lastDriverLine = [...transcript].reverse().find((l) => l.who === 'driver');
  const agentCaption =
    liveTranscript?.who === 'agent' ? liveTranscript.text : lastAgentLine?.text;
  const driverCaption =
    liveTranscript?.who === 'driver' ? liveTranscript.text : lastDriverLine?.text;

  const micLabel = isSpeaking
    ? t('voice.interrupt')
    : sessionConnected && muted
      ? t('voice.muted')
      : isListening
        ? t('voice.listening')
        : t('voice.talk');

  const modeLabel =
    preferredMode === 'agora'
      ? agoraStage === 'live'
        ? t('voice.modePill.agoraLive')
        : agoraStage === 'waiting_agent' || agoraStage === 'connecting'
          ? t('voice.modePill.agoraWaitingAgent')
          : t('voice.modePill.agoraDisconnected')
      : t('voice.modePill.mock');

  const routeLabel = t(`voice.audioRoute.${audioRoute}`);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-ink-950 px-5 pt-10 pb-8 justify-between">
        {/* Topo: Status Agora + Rota de Áudio + Mini-indicador de estadia */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center gap-1.5 bg-ink-900 border border-ok-500/60 rounded-full px-3 py-1.5">
                <View
                  className={`w-2.5 h-2.5 rounded-full ${
                    sessionConnected ? 'bg-ok-500' : 'bg-brand-500'
                  }`}
                />
                <Text className="text-ink-50 text-xs font-bold">{modeLabel}</Text>
              </View>

              <View className="flex-row items-center gap-1.5 bg-ink-900 border border-ink-700 rounded-full px-3 py-1.5">
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M11 5L6 9H2v6h4l5 4V5ZM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"
                    stroke="#099DFD"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text className="text-ink-300 text-xs font-semibold">{routeLabel}</Text>
              </View>
            </View>

            <VoiceStateIndicator />
          </View>

          {stayTimer ? (
            <View
              className={`rounded-2xl px-4 py-3 border flex-row items-center justify-between ${
                stayOver
                  ? 'bg-wait-500/15 border-wait-500/70'
                  : 'bg-ink-900 border-ink-700/80'
              }`}
            >
              <View className="flex-row items-center gap-2">
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Circle
                    cx={12}
                    cy={13}
                    r={8}
                    stroke={stayOver ? '#F5A524' : '#099DFD'}
                    strokeWidth={2}
                  />
                  <Path
                    d="M12 9v4l2.5 2.5"
                    stroke={stayOver ? '#F5A524' : '#099DFD'}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
                <Text className="text-ink-300 text-xs font-bold uppercase tracking-wider">
                  {t('stay.waiting')}
                </Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Text
                  style={{ fontVariant: ['tabular-nums'] }}
                  className={`text-xl font-bold ${stayOver ? 'text-wait-500' : 'text-ink-50'}`}
                >
                  {stayTimer}
                </Text>
                {stayValue ? (
                  <Text className="text-wait-500 text-sm font-bold">{stayValue}</Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        {/* Centro: Última fala do agente em fonte gigante + Waveform ampliado */}
        <View className="items-center justify-center px-2 my-4">
          <Text className="text-brand-500 text-xs font-bold uppercase tracking-widest mb-2">
            {t('voice.cabinMode.lastAgentSpeech')}
          </Text>
          <Text className="text-ink-50 text-2xl font-bold text-center leading-8">
            {agentCaption ? `“${agentCaption}”` : t('voice.emptyHint')}
          </Text>

          {driverCaption ? (
            <Text
              numberOfLines={2}
              className="text-ink-300 text-sm font-medium text-center mt-3"
            >
              {t('voice.driverTag')}: “{driverCaption}”
            </Text>
          ) : null}

          <View className="mt-6">
            <VoiceWaveform size="lg" />
          </View>

          {bargeInBanner && (
            <View className="mt-4 bg-wait-500/20 border border-wait-500 rounded-full px-4 py-2">
              <Text className="text-wait-500 text-sm font-bold">
                {t('voice.bargeInBanner')}
              </Text>
            </View>
          )}
        </View>

        {/* Base: Microfone gigante (128x128) + Mudo + Sair do Modo Cabine */}
        <View className="items-center gap-5">
          <Pressable
            onPress={() => {
              hapticTap();
              listen();
            }}
            accessibilityRole="button"
            accessibilityLabel={micLabel}
            style={{
              width: 128,
              height: 128,
              borderRadius: 999,
            }}
            className={`items-center justify-center active:opacity-85 ${
              isListening
                ? 'bg-brand-500 border-4 border-brand-50'
                : isSpeaking
                  ? 'bg-ok-500 border-4 border-ink-50'
                  : 'bg-ink-800 border-4 border-brand-500'
            }`}
          >
            {isSpeaking ? (
              <Svg width={46} height={46} viewBox="0 0 24 24" fill="none">
                <Rect x={6} y={6} width={4.5} height={12} rx={1.5} fill="#0B1220" />
                <Rect x={13.5} y={6} width={4.5} height={12} rx={1.5} fill="#0B1220" />
              </Svg>
            ) : (
              <Svg width={46} height={46} viewBox="0 0 24 24" fill="none">
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

          <Text className="text-ink-50 text-base font-bold uppercase tracking-wider">
            {micLabel}
          </Text>

          <View className="flex-row items-center gap-3 w-full">
            <Pressable
              onPress={() => {
                hapticTap();
                toggleMute();
              }}
              accessibilityRole="button"
              className={`flex-1 py-4 rounded-2xl border items-center justify-center active:opacity-80 ${
                muted
                  ? 'bg-wait-500/20 border-wait-500'
                  : 'bg-ink-900 border-ink-700'
              }`}
            >
              <Text
                className={`text-sm font-bold ${
                  muted ? 'text-wait-500' : 'text-ink-50'
                }`}
              >
                {muted ? t('voice.unmuteButton') : t('voice.muteButton')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                hapticTap();
                onClose();
              }}
              accessibilityRole="button"
              className="flex-1 py-4 rounded-2xl border border-ink-700 bg-ink-800 items-center justify-center active:opacity-80"
            >
              <Text className="text-ink-50 text-sm font-bold">
                {t('voice.cabinMode.exitButton')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
