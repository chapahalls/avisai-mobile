import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActiveVoiceBar } from './ActiveVoiceBar';
import { HeadsUpBanner } from './HeadsUpBanner';
import { NetworkBanner } from './NetworkBanner';
import { VoiceCommandToast } from './VoiceCommandToast';

export function Screen({
  children,
  scroll = true,
  hideActiveVoiceBar = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  hideActiveVoiceBar?: boolean;
}) {
  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <NetworkBanner />
      <VoiceCommandToast />
      <HeadsUpBanner />
      {!hideActiveVoiceBar && <ActiveVoiceBar />}
      {scroll ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>{children}</ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}
