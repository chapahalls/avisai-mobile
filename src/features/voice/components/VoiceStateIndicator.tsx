import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useVoice } from '../hooks/useVoice';

const pillTone = {
  idle: 'bg-ink-800 border-ink-700',
  listening: 'bg-brand-500/15 border-brand-500/60',
  thinking: 'bg-brand-600/20 border-brand-500/50',
  speaking: 'bg-ok-500/15 border-ok-500/60',
  interrupted: 'bg-wait-500/15 border-wait-500/60',
} as const;

const dotTone = {
  idle: 'bg-ink-300',
  listening: 'bg-brand-500',
  thinking: 'bg-brand-500',
  speaking: 'bg-ok-500',
  interrupted: 'bg-wait-500',
} as const;

const textTone = {
  idle: 'text-ink-300',
  listening: 'text-brand-50',
  thinking: 'text-brand-50',
  speaking: 'text-ink-50',
  interrupted: 'text-wait-500',
} as const;

/** Sempre com legenda em texto: a cor sozinha não comunica o estado. */
export function VoiceStateIndicator() {
  const { t } = useTranslation();
  const state = useVoice((s) => s.state);
  const latency = useVoice((s) => s.lastLatencyMs);
  return (
    <View className={`flex-row items-center gap-1.5 border rounded-full px-2.5 py-1 ${pillTone[state]}`}>
      <View className={`w-2 h-2 rounded-full ${dotTone[state]}`} />
      <Text className={`text-sm font-semibold ${textTone[state]}`}>
        {t(`voice.state.${state}`)}
      </Text>
      {latency !== null && (
        <Text
          style={{ fontVariant: ['tabular-nums'] }}
          className="text-ink-300 text-xs font-medium"
        >
          · {latency} ms
        </Text>
      )}
    </View>
  );
}
