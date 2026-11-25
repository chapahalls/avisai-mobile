import { Text, View } from 'react-native';

/**
 * Etiqueta de status (mockups RODAR-telas): fundo tingido e texto na cor do tom.
 * O texto sempre diz o estado; a cor só reforça.
 */
const tones = {
  brand: { box: 'bg-brand-500/20', text: 'text-brand-300' },
  ok: { box: 'bg-ok-500/15', text: 'text-ok-500' },
  wait: { box: 'bg-wait-500/15', text: 'text-wait-500' },
  alert: { box: 'bg-alert-500/15', text: 'text-alert-500' },
  info: { box: 'bg-info-900', text: 'text-info-300' },
  neutral: { box: 'bg-ink-800', text: 'text-ink-300' },
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <View className={`rounded-lg px-2.5 py-1 self-start ${tones[tone].box}`}>
      <Text numberOfLines={1} className={`text-xs font-bold ${tones[tone].text}`}>
        {label}
      </Text>
    </View>
  );
}
