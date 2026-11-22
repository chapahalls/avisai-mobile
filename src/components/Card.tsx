import type { ReactNode } from 'react';
import { View } from 'react-native';

export function Card({ children }: { children: ReactNode }) {
  return <View className="bg-ink-900 border border-ink-700 rounded-card p-4">{children}</View>;
}
