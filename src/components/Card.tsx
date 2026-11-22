import type { ReactNode } from 'react';
import { View } from 'react-native';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <View className={`bg-ink-900 border border-ink-700/80 rounded-2xl p-4 ${className}`}>
      {children}
    </View>
  );
}
