import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MockDocument } from '../types';

/**
 * Visualizador de PDF MOCK (react-native-pdf não roda no Expo Go).
 * Renderiza as páginas como folhas brancas. No dev build: trocar por <Pdf source={{ uri }} />.
 */
export function MockPdfViewer({ doc }: { doc: MockDocument }) {
  const { t } = useTranslation();
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
      <Text className="text-ink-300 text-xs mb-3">{t('documents.mockNotice')}</Text>
      {doc.pages.map((p, i) => (
        <View key={i} className="bg-ink-50 rounded-input p-5 mb-4 min-h-[320px]">
          <Text className="text-ink-950 text-sm leading-6 font-mono">{p}</Text>
          <Text className="text-ink-700 text-xs mt-auto text-right">
            {t('documents.page', { n: i + 1, total: doc.pages.length })}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
