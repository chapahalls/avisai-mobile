import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/** Cabeçalho das abas (mockups RODAR-telas): linha de contexto pequena + título grande. */
export function ScreenTitle({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <View className="flex-row items-end justify-between gap-3">
      <View className="flex-1">
        {eyebrow ? (
          <Text numberOfLines={1} className="text-ink-300 text-sm">
            {eyebrow}
          </Text>
        ) : null}
        <Text accessibilityRole="header" className="text-ink-50 text-3xl font-display mt-0.5">
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

/** Rótulo de seção em caixa alta ("CARGA", "TRANSPORTE"). */
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" className="text-ink-300 text-xs font-bold uppercase tracking-widest">
      {children}
    </Text>
  );
}
