import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { Screen } from '../components/Screen';
import { Badge } from '../components/Badge';
import { DocumentList, useDocuments } from '../features/documents';
import { useApiConfig } from '../services/api';
import type { RootStackParams } from '../app/navigation';

export function DocumentsPage() {
  const { t } = useTranslation();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const documents = useDocuments((s) => s.documents);
  const syncFromBackend = useDocuments((s) => s.syncFromBackend);
  const apiMode = useApiConfig((s) => s.mode);
  const rotaId = useApiConfig((s) => s.rotaId);

  useEffect(() => {
    if (apiMode === 'http') {
      void syncFromBackend(String(rotaId));
    }
  }, [apiMode, rotaId, syncFromBackend]);

  return (
    <Screen>
      {/* Header com título e badge de contagem */}
      <View className="flex-row items-center justify-between">
        <Text className="text-ink-50 text-2xl font-bold tracking-tight">
          {t('documents.title')}
        </Text>
        <Badge
          tone="brand"
          label={t('documents.countBadge', { count: documents.length })}
        />
      </View>

      {/* Banner de dica de consulta por voz */}
      <View className="flex-row items-center gap-2.5 bg-brand-500/10 border border-brand-500/30 rounded-xl px-3.5 py-2.5">
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2"
            stroke="#099DFD"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
        <Text className="text-ink-50 text-xs font-medium flex-1">{t('documents.hint')}</Text>
      </View>

      <DocumentList onOpen={(d) => nav.navigate('DocumentViewer', { id: d.id })} />
    </Screen>
  );
}
