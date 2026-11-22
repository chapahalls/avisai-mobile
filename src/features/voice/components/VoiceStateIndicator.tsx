import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useVoice } from '../hooks/useVoice';

const ring = {
  idle: 'border-ink-700',
  listening: 'border-brand-500',
  thinking: 'border-brand-600',
  speaking: 'border-ok-500',
  interrupted: 'border-wait-500',
} as const;

/** Sempre com legenda em texto: a cor sozinha não comunica o estado. */
export function VoiceStateIndicator() {
  const { t } = useTranslation();
  const state = useVoice((s) => s.state);
  const latency = useVoice((s) => s.lastLatencyMs);
  return (
    <View className="flex-row items-center gap-2">
      <View className={`w-3 h-3 rounded-full border-2 ${ring[state]}`} />
      <Text className="text-ink-300 text-sm">{t(`voice.state.${state}`)}</Text>
      {latency !== null && <Text className="text-ink-300 text-xs">· {latency} ms</Text>}
    </View>
  );
}
