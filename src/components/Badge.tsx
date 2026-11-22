import { Text, View } from 'react-native';

const tones = {
  brand: 'bg-brand-500/20 border-brand-500',
  ok: 'bg-ok-500/20 border-ok-500',
  wait: 'bg-wait-500/20 border-wait-500',
  alert: 'bg-alert-500/20 border-alert-500',
} as const;

export function Badge({ label, tone }: { label: string; tone: keyof typeof tones }) {
  return (
    <View className={`border rounded-full px-2 py-0.5 ${tones[tone]}`}>
      <Text className="text-ink-50 text-xs">{label}</Text>
    </View>
  );
}
