import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { VoiceWaveform, useVoice } from '../features/voice';
import { hapticTap } from '../utils/haptics';

function navigateToTrip(): void {
  if (process.env.VITEST) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { navigationRef } = require('../app/navigation') as typeof import('../app/navigation');
    if (navigationRef?.isReady()) {
      navigationRef.navigate('Main', { screen: 'Trip' });
    }
  } catch {
    // Ignora caso navegação ainda não esteja pronta
  }
}

/**
 * Mini-barra persistente de Voz em todas as abas (A3):
 * Mostra ponto verde `GPT-Live` (ou `AvisAI falando`), mini indicador de volume,
 * botão compacto Mudo, botão Ir p/ Voz e botão Encerrar.
 */
export function ActiveVoiceBar() {
  const { t } = useTranslation();
  const state = useVoice((s) => s.state);
  const sessionConnected = useVoice((s) => s.sessionConnected);
  const muted = useVoice((s) => s.muted);
  const toggleMute = useVoice((s) => s.toggleMute);
  const stop = useVoice((s) => s.stop);

  const isVisible = sessionConnected || state === 'speaking' || state === 'listening';
  if (!isVisible) return null;

  const statusText =
    state === 'speaking'
      ? t('voice.activeBar.agentSpeaking')
      : sessionConnected
        ? muted
          ? t('voice.activeBar.agoraMuted')
          : t('voice.modePill.agoraLive')
        : t('voice.activeBar.listening');

  return (
    <View className="bg-ink-900 border-b border-ok-500/50 px-3.5 py-2 flex-row items-center justify-between gap-2">
      <View className="flex-row items-center gap-2 flex-1">
        <View
          className={`w-2.5 h-2.5 rounded-full ${
            muted ? 'bg-wait-500' : 'bg-ok-500'
          }`}
        />
        <Text numberOfLines={1} className="text-ink-50 text-xs font-bold">
          {statusText}
        </Text>
        <View className="ml-1">
          <VoiceWaveform size="sm" />
        </View>
      </View>

      <View className="flex-row items-center gap-1.5">
        <Pressable
          onPress={() => {
            hapticTap();
            toggleMute();
          }}
          accessibilityRole="button"
          className={`px-2.5 py-1 rounded-full border active:opacity-80 ${
            muted
              ? 'bg-wait-500/20 border-wait-500'
              : 'bg-ink-800 border-ink-700'
          }`}
        >
          <Text
            className={`text-[11px] font-bold ${
              muted ? 'text-wait-500' : 'text-ink-50'
            }`}
          >
            {muted ? t('voice.unmuteButton') : t('voice.muteButton')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            hapticTap();
            navigateToTrip();
          }}
          accessibilityRole="button"
          className="px-2.5 py-1 rounded-full border border-brand-500/70 bg-brand-500/20 active:opacity-80"
        >
          <Text className="text-brand-500 text-[11px] font-bold">
            {t('voice.activeBar.goToVoice')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            hapticTap();
            stop();
          }}
          accessibilityRole="button"
          className="px-2.5 py-1 rounded-full border border-alert-500/70 bg-alert-500/15 active:opacity-80"
        >
          <Text className="text-alert-500 text-[11px] font-bold">
            {t('voice.activeBar.endShort')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
