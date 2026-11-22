import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NetworkBanner } from './NetworkBanner';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <NetworkBanner />
      {scroll ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>{children}</ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}
