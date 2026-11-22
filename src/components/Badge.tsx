import { Text, View } from 'react-native';

const tones = {
  brand: 'bg-brand-500/15 border-brand-500/60',
  ok: 'bg-ok-500/15 border-ok-500/60',
  wait: 'bg-wait-500/15 border-wait-500/60',
  alert: 'bg-alert-500/15 border-alert-500/60',
} as const;

const dots = {
  brand: 'bg-brand-500',
  ok: 'bg-ok-500',
  wait: 'bg-wait-500',
  alert: 'bg-alert-500',
} as const;

export function Badge({ label, tone }: { label: string; tone: keyof typeof tones }) {
  return (
    <View className={`flex-row items-center gap-1.5 border rounded-full px-2.5 py-1 ${tones[tone]}`}>
      <View className={`w-1.5 h-1.5 rounded-full ${dots[tone]}`} />
      <Text className="text-ink-50 text-xs font-semibold">{label}</Text>
    </View>
  );
}
