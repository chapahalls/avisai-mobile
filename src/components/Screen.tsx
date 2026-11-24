import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeadsUpBanner } from './HeadsUpBanner';
import { NetworkBanner } from './NetworkBanner';
import { VoiceCommandToast } from './VoiceCommandToast';

/** Espaço no fim da rolagem para o conteúdo não ficar atrás da esfera do AvisAI. */
export const DOCK_CLEARANCE = 112;

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <NetworkBanner />
      <VoiceCommandToast />
      <HeadsUpBanner />
      {scroll ? (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: DOCK_CLEARANCE,
            gap: 16,
          }}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}
