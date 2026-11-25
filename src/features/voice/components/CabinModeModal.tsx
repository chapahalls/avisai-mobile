import { Modal, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../../components/Icon';
import { colors } from '../../../lib/theme';
import { hapticTap } from '../../../utils/haptics';
import { useMicStatus } from '../hooks/useMicStatus';
import { useVoice } from '../hooks/useVoice';
import { AuroraVoiceOrb } from './AuroraVoiceOrb';
import { VoiceStateIndicator } from './VoiceStateIndicator';

export interface CabinModeModalProps {
  visible: boolean;
  onClose: () => void;
  stayTimer?: string | null;
  stayValue?: string | null;
  stayOver?: boolean;
  /** Pílula de contexto no topo (ex.: "Modo viagem · 82 km/h"); sem ela, mostra o modo de voz. */
  contextPill?: string | null;
}

/**
 * Conversa em tela cheia com o AvisAI (mockup `06-chat-ao-vivo`), mãos-livres:
 * esfera grande (toque = falar / interromper), última fala em fonte grande,
 * mudo, rota de áudio e contador de espera quando houver.
 */
export function CabinModeModal({
  visible,
  onClose,
  stayTimer,
  stayValue,
  stayOver = false,
  contextPill,
}: CabinModeModalProps) {
  const { t } = useTranslation();
  const state = useVoice((s) => s.state);
  const transcript = useVoice((s) => s.transcript);
  const liveTranscript = useVoice((s) => s.liveTranscript);
  const preferredMode = useVoice((s) => s.preferredMode);
  const agoraStage = useVoice((s) => s.agoraStage);
  const sessionConnected = useVoice((s) => s.sessionConnected);
  const offlineWhisperActive = useVoice((s) => s.offlineWhisperActive);
  const muted = useVoice((s) => s.muted);
  const audioLevel = useVoice((s) => s.audioLevel);
  const audioSpeaker = useVoice((s) => s.audioSpeaker);
  const audioRoute = useVoice((s) => s.audioRoute);
  const bargeInBanner = useVoice((s) => s.bargeInBanner);
  const listen = useVoice((s) => s.listen);
  const toggleMute = useVoice((s) => s.toggleMute);
  const stop = useVoice((s) => s.stop);
  const { label: micLabel, hint: micHint, isActive, directVoice } = useMicStatus();

  const lastAgentLine = [...transcript].reverse().find((l) => l.who === 'agent');
  const lastDriverLine = [...transcript].reverse().find((l) => l.who === 'driver');
  const agentCaption =
    liveTranscript?.who === 'agent' ? liveTranscript.text : lastAgentLine?.text;
  const driverCaption =
    liveTranscript?.who === 'driver' ? liveTranscript.text : lastDriverLine?.text;

  const modeLabel =
    offlineWhisperActive
      ? t('voice.modePill.offlineWhisper')
      : preferredMode === 'agora'
        ? agoraStage === 'live'
          ? t('voice.modePill.agoraLive')
          : agoraStage === 'waiting_agent' || agoraStage === 'connecting'
            ? t('voice.modePill.agoraWaitingAgent')
            : t('voice.modePill.agoraDisconnected')
        : t('voice.modePill.mock');

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-ink-950 px-5 pt-10 pb-8 justify-between">
        {/* Topo: voltar · pílula de contexto · mudo */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <Pressable
              onPress={() => {
                hapticTap();
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={t('voice.cabinMode.exitButton')}
              className="w-14 h-14 rounded-full bg-ink-800 items-center justify-center active:opacity-80"
            >
              <Icon name="chevronLeft" size={24} />
            </Pressable>

            <View className="flex-1 flex-row items-center justify-center gap-2 bg-ink-800 rounded-full px-4 py-2.5">
              <View
                className={`w-2.5 h-2.5 rounded-full ${contextPill ? 'bg-wait-500' : sessionConnected || offlineWhisperActive ? 'bg-ok-500' : 'bg-ink-300'}`}
              />
              <Text
                numberOfLines={1}
                className={`text-sm font-bold ${contextPill ? 'text-wait-500' : 'text-ink-50'}`}
              >
                {contextPill ?? modeLabel}
              </Text>
            </View>

            <Pressable
              onPress={() => {
                hapticTap();
                toggleMute();
              }}
              accessibilityRole="button"
              accessibilityLabel={muted ? t('voice.unmuteButton') : t('voice.muteButton')}
              accessibilityState={{ selected: muted }}
              className={`w-14 h-14 rounded-full items-center justify-center active:opacity-80 ${
                muted ? 'bg-wait-500' : 'bg-ink-800'
              }`}
            >
              <Icon name="mic" size={22} color={muted ? colors.ink[950] : colors.ink[50]} />
            </Pressable>
          </View>

          <View className="flex-row items-center justify-center gap-2">
            <VoiceStateIndicator />
            <View className="flex-row items-center gap-1.5 bg-ink-800 rounded-full px-2.5 py-1">
              <Icon name="speaker" size={13} color={colors.ink[300]} />
              <Text className="text-ink-300 text-xs font-semibold">
                {t(`voice.audioRoute.${audioRoute}`)}
              </Text>
            </View>
            {muted ? (
              <Text className="text-wait-500 text-xs font-bold">{t('voice.muted')}</Text>
            ) : null}
          </View>

          {stayTimer ? (
            <View
              className={`self-center flex-row items-center gap-2 rounded-full px-4 py-2 ${
                stayOver ? 'bg-wait-500/15' : 'bg-ink-800'
              }`}
            >
              <Icon name="clock" size={16} color={stayOver ? colors.wait[500] : colors.brand[300]} />
              <Text className="text-ink-300 text-xs font-bold uppercase">{t('stay.waiting')}</Text>
              <Text
                style={{ fontVariant: ['tabular-nums'] }}
                className={`text-base font-display ${stayOver ? 'text-wait-500' : 'text-ink-50'}`}
              >
                {stayTimer}
              </Text>
              {stayValue ? <Text className="text-wait-500 text-sm font-bold">{stayValue}</Text> : null}
            </View>
          ) : null}
        </View>

        {/* Centro: esfera (toque = falar / interromper) + última fala */}
        <View className="items-center">
          <Pressable
            onPress={() => {
              hapticTap();
              listen();
            }}
            accessibilityRole="button"
            accessibilityLabel={micLabel}
            accessibilityHint={micHint}
            accessibilityState={{ selected: isActive }}
            style={{ width: 236, height: 236, borderRadius: 999 }}
            className="items-center justify-center active:opacity-90"
          >
            <AuroraVoiceOrb
              state={state}
              muted={muted}
              audioLevel={audioLevel}
              audioSpeaker={audioSpeaker}
              size={236}
              showGlyph={false}
            />
          </Pressable>

          <Text className="text-brand-300 text-base font-bold mt-6">{t('voice.agentTag')}</Text>
          <Text className="text-ink-50 text-2xl text-center leading-9 mt-2 px-2">
            {directVoice ? t('voice.directVoiceHint') : agentCaption ?? t('voice.emptyHint')}
          </Text>
          {!directVoice && driverCaption ? (
            <Text numberOfLines={2} className="text-ink-300 text-sm text-center mt-3">
              {t('voice.driverTag')}: “{driverCaption}”
            </Text>
          ) : null}
          {bargeInBanner ? (
            <View accessibilityRole="alert" className="mt-4 bg-wait-500/20 rounded-full px-4 py-2">
              <Text className="text-wait-500 text-sm font-bold">{t('voice.bargeInBanner')}</Text>
            </View>
          ) : null}
        </View>

        {/* Base: estado do microfone + falar, e encerrar a sessão real */}
        <View className="gap-3">
          {sessionConnected || offlineWhisperActive ? (
            <Pressable
              onPress={() => {
                hapticTap();
                stop();
                onClose();
              }}
              accessibilityRole="button"
              className="self-center bg-alert-500/15 rounded-full px-5 py-2.5 active:opacity-80"
            >
              <Text className="text-alert-500 text-sm font-bold">{t('voice.endSessionButton')}</Text>
            </Pressable>
          ) : null}
          <View className="flex-row items-center gap-3">
            <View className="flex-1 bg-ink-800 rounded-full px-5 py-4">
              <Text numberOfLines={1} className="text-ink-50 text-base font-semibold">
                {micLabel}
              </Text>
              <Text numberOfLines={1} className="text-ink-300 text-xs mt-0.5">
                {t('voice.cabinMode.voiceOnlyWhileMoving')}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                hapticTap();
                listen();
              }}
              accessibilityRole="button"
              accessibilityLabel={micLabel}
              accessibilityHint={micHint}
              className={`w-16 h-16 rounded-full items-center justify-center active:opacity-80 ${
                isActive ? 'bg-brand-500' : 'bg-ink-800'
              }`}
            >
              <Icon name="mic" size={26} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
