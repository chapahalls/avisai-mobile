import { Fragment } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/Badge';
import type { MockDocument } from '../types';
import { documentGroup } from './DocumentList';

/**
 * Documento aberto (mockup `10-documento-guiado`): trilha Documentos › grupo › documento e
 * a folha clara com os campos verificados, pronta para mostrar à fiscalização.
 * PDF MOCK: react-native-pdf não roda no Expo Go; as páginas aparecem como texto.
 */
export function MockPdfViewer({ doc }: { doc: MockDocument }) {
  const { t } = useTranslation();
  const entries = Object.entries(doc.fields).filter(([k]) => k !== 'numero');
  const number = doc.fields.numero;

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>
      {/* Trilha */}
      <View className="flex-row flex-wrap items-center gap-2" accessibilityRole="text">
        <Crumb label={t('documents.title')} />
        <Text className="text-ink-300">›</Text>
        <Crumb label={t(`documents.groups.${documentGroup(doc)}`)} />
        <Text className="text-ink-300">›</Text>
        <Crumb label={doc.title} current />
      </View>

      {/* Folha clara com os campos verificados */}
      <View className="bg-ink-50 rounded-3xl p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-ink-700 text-xs font-bold uppercase tracking-widest">{doc.kind}</Text>
            <Text className="text-ink-950 text-2xl font-display mt-1">
              {number ? t('documents.numberShort', { number }) : doc.title}
            </Text>
          </View>
          <Badge tone="ok" label={t('documents.badge.verified')} />
        </View>
        {entries.map(([k, v]) => (
          <Fragment key={k}>
            <View className="h-px bg-ink-300/60 my-3" />
            <Text className="text-ink-700 text-sm">{t(`documents.fieldLabels.${k}`, k)}</Text>
            <Text
              className={`text-ink-950 mt-0.5 ${k === 'chave' ? 'text-sm font-mono font-bold' : 'text-lg font-bold'}`}
            >
              {v}
            </Text>
          </Fragment>
        ))}
        <View className="h-px bg-ink-300/60 my-3" />
        <Text className="text-ink-700 text-sm">{t('documents.verifiedSubtitle')}</Text>
      </View>

      {/* Páginas do PDF simulado */}
      {doc.pages.map((p, i) => (
        <View key={i} className="bg-ink-900 border border-ink-800 rounded-3xl p-5">
          <View className="flex-row items-center justify-between pb-3 mb-3 border-b border-ink-800">
            <Text className="text-ink-300 text-xs font-bold uppercase tracking-widest">
              {t('documents.page', { n: i + 1, total: doc.pages.length })}
            </Text>
            <Text className="text-ink-300 text-xs">{t('documents.mockNotice')}</Text>
          </View>
          <Text className="text-ink-50 text-sm leading-6 font-mono">{p}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function Crumb({ label, current = false }: { label: string; current?: boolean }) {
  return (
    <View className={`rounded-full px-3.5 py-1.5 ${current ? 'bg-wait-500' : 'bg-brand-500/20'}`}>
      <Text
        numberOfLines={1}
        className={`text-sm font-bold ${current ? 'text-ink-950' : 'text-brand-300'}`}
      >
        {label}
      </Text>
    </View>
  );
}
