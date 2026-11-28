import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParams } from '../app/navigation';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { ScreenTitle } from '../components/ScreenTitle';
import { DocumentList, useDocuments } from '../features/documents';
import { useTrip } from '../features/trip';
import { useTalkToAvisai, useVoice } from '../features/voice';
import { useApiConfig } from '../services/api';
import { hapticTap } from '../utils/haptics';

/** Documentos (mockup `09-documentos`): pedir ao AvisAI e a lista agrupada da viagem. */
export function DocumentsPage() {
  const { t } = useTranslation();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const documents = useDocuments((s) => s.documents);
  const syncFromBackend = useDocuments((s) => s.syncFromBackend);
  const apiMode = useApiConfig((s) => s.mode);
  const rotaId = useApiConfig((s) => s.rotaId);
  const activeRoute = useTrip((s) => s.activeRoute);
  const talkToAvisai = useTalkToAvisai();

  useEffect(() => {
    if (apiMode === 'http') {
      void syncFromBackend(String(rotaId));
    }
  }, [apiMode, rotaId, syncFromBackend]);

  const askAvisai = () => {
    hapticTap();
    useVoice.getState().setContext('free');
    talkToAvisai();
  };

  return (
    <Screen>
      <ScreenTitle
        eyebrow={t('documents.eyebrow', { trip: activeRoute.tripId, plate: activeRoute.plate })}
        title={t('documents.title')}
        right={
          <Text className="text-ink-300 text-base mb-1">
            {t('documents.countBadge', { count: documents.length })}
          </Text>
        }
      />

      <Pressable
        onPress={askAvisai}
        accessibilityRole="button"
        className="bg-brand-500/20 border border-brand-600 rounded-3xl p-4 flex-row items-center gap-4 active:opacity-85"
      >
        <View className="w-14 h-14 rounded-full bg-brand-500 items-center justify-center">
          <Icon name="mic" size={24} />
        </View>
        <View className="flex-1">
          <Text className="text-ink-50 text-lg font-bold">{t('documents.askTitle')}</Text>
          <Text className="text-ink-300 text-sm mt-0.5 leading-5">{t('documents.hint')}</Text>
        </View>
      </Pressable>

      <DocumentList onOpen={(d) => nav.navigate('DocumentViewer', { id: d.id })} />
    </Screen>
  );
}
