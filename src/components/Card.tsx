import type { ReactNode } from 'react';
import { View } from 'react-native';

/** Card padrão dos mockups RODAR-telas: superfície `ink-900`, borda discreta, raio grande. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <View className={`bg-ink-900 border border-ink-800 rounded-3xl p-4 ${className}`}>
      {children}
    </View>
  );
}
