import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import { Badge } from '../../../components/Badge';
import type { MockDocument } from '../types';

/**
 * Visualizador de PDF MOCK (react-native-pdf não roda no Expo Go).
 * Exibe os campos verificados (transparência anti-alucinação) + páginas como folhas estruturadas.
 */
export function MockPdfViewer({ doc }: { doc: MockDocument }) {
  const { t } = useTranslation();
  const fieldEntries = Object.entries(doc.fields);

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
      {/* Cabeçalho do documento e aviso mock */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-ink-50 text-lg font-bold">{doc.title}</Text>
          <Badge tone={doc.kind === 'NF-e' ? 'brand' : 'ok'} label={doc.kind} />
        </View>
        <Text className="text-ink-300 text-xs">{t('documents.mockNotice')}</Text>
      </View>

      {/* Bloco de Campos Extraídos Verificados (Grid de 2 colunas) */}
      <View className="bg-ink-900 border border-ink-700/80 rounded-2xl p-4 mb-4">
        <View className="flex-row items-center gap-2 mb-1">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={9} stroke="#17B26A" strokeWidth={2} />
            <Path
              d="M8.5 12.5l2.5 2.5 4.5-5"
              stroke="#17B26A"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text className="text-ink-50 text-sm font-bold">{t('documents.verifiedTitle')}</Text>
        </View>
        <Text className="text-ink-300 text-xs mb-3">{t('documents.verifiedSubtitle')}</Text>

        <View className="flex-row flex-wrap -mx-1">
          {fieldEntries.map(([k, v]) => (
            <View key={k} className="w-1/2 px-1 mb-2">
              <View className="bg-ink-800 border border-ink-700/80 rounded-xl p-2.5">
                <Text className="text-ink-300 text-[10px] font-semibold uppercase tracking-wider">
                  {t(`documents.fieldLabels.${k}`, k)}
                </Text>
                <Text numberOfLines={2} className="text-ink-50 text-xs font-bold mt-0.5">
                  {v}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Folhas do PDF Simulado */}
      {doc.pages.map((p, i) => (
        <View
          key={i}
          className="bg-ink-50 border border-ink-300 rounded-2xl p-5 mb-4 min-h-[280px] justify-between"
        >
          <View>
            <View className="flex-row items-center justify-between pb-3 mb-3 border-b border-ink-300/60">
              <Text className="text-ink-900 text-xs font-bold tracking-wider uppercase">
                {doc.title}
              </Text>
              <Text className="text-ink-700 text-xs font-mono">{doc.kind}</Text>
            </View>
            <Text className="text-ink-950 text-sm leading-6 font-mono">{p}</Text>
          </View>
          <View className="pt-3 mt-6 border-t border-ink-300/60 flex-row items-center justify-between">
            <Text className="text-ink-700 text-[11px] font-medium">
              {t('documents.mockNotice')}
            </Text>
            <Text className="text-ink-900 text-xs font-semibold">
              {t('documents.page', { n: i + 1, total: doc.pages.length })}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
