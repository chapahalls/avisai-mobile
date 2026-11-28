import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { DemoControls, useDrivingMode } from '../features/trip';
import { AuroraVoiceOrb, getQuickUtterances, useMicStatus, useVoice } from '../features/voice';
import { getCurrentLanguage } from '../lib/i18n';
import { colors } from '../lib/theme';
import { useApiConfig } from '../services/api';
import { hapticTap } from '../utils/haptics';

/**
 * Modo direção (como o Waze): com o caminhão andando, uma tela por cima de tudo trava o app.
 * Só sobra a voz: esfera grande (toque = falar / interromper) e a última fala do AvisAI em
 * letra grande. Parou, a tela some sozinha e o que ficou pendente (ex.: abrir o PDF) abre.
 * No modo simulado, um bloco tracejado (E8) deixa a demo seguir sem GPS de verdade.
 */
export function DrivingLock() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const driving = useDrivingMode((s) => s.driving);
  const speedKmh = useDrivingMode((s) => s.speedKmh);
  const source = useDrivingMode((s) => s.source);
  const state = useVoice((s) => s.state);
  const muted = useVoice((s) => s.muted);
  const audioLevel = useVoice((s) => s.audioLevel);
  const audioSpeaker = useVoice((s) => s.audioSpeaker);
  const transcript = useVoice((s) => s.transcript);
  const liveTranscript = useVoice((s) => s.liveTranscript);
  const listen = useVoice((s) => s.listen);
  const utter = useVoice((s) => s.utter);
  const { directVoice } = useMicStatus();
  const apiMode = useApiConfig((s) => s.mode);
  const [demoOpen, setDemoOpen] = useState(false);

  const lastAgent = [...transcript].reverse().find((l) => l.who === 'agent');
  const caption = liveTranscript?.who === 'agent' ? liveTranscript.text : lastAgent?.text;
  const stateLabel = t(`voice.state.${state}`);
  const showDemo = !directVoice || apiMode === 'mock';

  return (
    <Modal
      visible={driving}
      animationType="fade"
      statusBarTranslucent
      // Botão voltar do Android não sai do modo direção: só parar o caminhão libera.
      onRequestClose={() => undefined}
    >
      <View
        className="flex-1 bg-ink-950 px-5"
        style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}
      >
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-2 bg-wait-500/15 border border-wait-500 rounded-full px-4 py-2">
            <Icon name="navigation" size={18} color={colors.wait[500]} />
            <Text accessibilityRole="header" className="text-wait-500 text-base font-bold">
              {t('driving.title')}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-ink-50 text-3xl font-display">
              {speedKmh !== null ? t('driving.speed', { kmh: speedKmh }) : t('driving.speedUnknown')}
            </Text>
            <Text className="text-ink-300 text-sm">
              {source === 'gps' ? t('driving.sourceGps') : t('driving.sourceSimulator')}
            </Text>
          </View>
        </View>

        <View className="flex-1 items-center justify-center gap-6">
          <Pressable
            onPress={() => {
              hapticTap();
              listen();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('driving.orbLabel', { state: stateLabel })}
            className="active:opacity-85"
          >
            <AuroraVoiceOrb
              state={state}
              muted={muted}
              audioLevel={audioLevel}
              audioSpeaker={audioSpeaker}
              size={176}
            />
          </Pressable>
          <Text className="text-brand-300 text-base font-bold">{stateLabel}</Text>
          <Text
            accessibilityLiveRegion="polite"
            numberOfLines={6}
            className="text-ink-50 text-2xl leading-9 text-center"
          >
            {caption ?? t('driving.talkHint')}
          </Text>
        </View>

        <Text className="text-ink-300 text-base leading-6 text-center">{t('driving.body')}</Text>
        <Text className="text-ink-300 text-sm text-center mt-2">{t('driving.unlockHint')}</Text>

        {showDemo ? (
          <View className="mt-4 border border-dashed border-ink-700 rounded-2xl p-3">
            <Text className="text-ink-300 text-xs font-bold uppercase tracking-widest">
              {t('driving.demoTitle')} · {t('driving.demoSimulateLabel')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
              {getQuickUtterances('free', getCurrentLanguage()).map((u) => (
                <Pressable
                  key={u}
                  onPress={() => {
                    hapticTap();
                    utter(u);
                  }}
                  accessibilityRole="button"
                  className="bg-ink-800 border border-ink-700 rounded-full px-4 py-2 active:opacity-80"
                >
                  <Text className="text-ink-50 text-sm font-bold">“{u}”</Text>
                </Pressable>
              ))}
            </ScrollView>
            {apiMode === 'mock' ? (
              <Pressable
                onPress={() => setDemoOpen(true)}
                accessibilityRole="button"
                className="flex-row items-center justify-center gap-2 py-2 active:opacity-80"
              >
                <Icon name="sliders" size={16} color={colors.ink[300]} />
                <Text className="text-ink-300 text-sm font-bold">{t('driving.demoControls')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <Modal visible={demoOpen} transparent animationType="slide" onRequestClose={() => setDemoOpen(false)}>
        <View className="flex-1 justify-end bg-ink-950/80">
          <Pressable className="flex-1" onPress={() => setDemoOpen(false)} accessibilityLabel={t('driving.demoClose')} />
          <View className="bg-ink-950 border-t border-ink-800 rounded-t-[32px] px-4 pt-3 pb-8">
            <View className="w-10 h-1 rounded-full bg-ink-700 self-center mb-3" />
            <DemoControls onClose={() => setDemoOpen(false)} />
          </View>
        </View>
      </Modal>
    </Modal>
  );
}
