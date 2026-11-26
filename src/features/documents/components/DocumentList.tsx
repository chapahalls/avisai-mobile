import { Fragment } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/Badge';
import { SectionLabel } from '../../../components/ScreenTitle';
import { useDocuments } from '../hooks/useDocuments';
import type { TripDocument } from '../types';

type Group = 'cargo' | 'transport' | 'files';

const GROUP_ORDER: Group[] = ['cargo', 'transport', 'files'];

export function documentGroup(doc: TripDocument): Group {
  if (doc.kind === 'NF-e') return 'cargo';
  if (doc.kind === 'CT-e' || doc.kind === 'MDF-e') return 'transport';
  return 'files';
}

/** Linha de apoio: os campos mais úteis na estrada, sem número nem chave. */
function summaryOf(doc: TripDocument): string {
  const skip = new Set(['numero', 'chave', 'nfe_referenciada', 'placa']);
  return Object.entries(doc.fields)
    .filter(([k]) => !skip.has(k))
    .slice(0, 3)
    .map(([, v]) => v)
    .join(' · ');
}

/** Lista agrupada (mockup `09-documentos`): Carga, Transporte e Anexos, uma linha por documento. */
export function DocumentList({ onOpen }: { onOpen: (d: TripDocument) => void }) {
  const { t } = useTranslation();
  const documents = useDocuments((s) => s.documents);

  return (
    <View className="gap-4">
      {GROUP_ORDER.map((group) => {
        const docs = documents.filter((d) => documentGroup(d) === group);
        if (docs.length === 0) return null;
        return (
          <View key={group} className="gap-2">
            <SectionLabel>{t(`documents.groups.${group}`)}</SectionLabel>
            <View className="bg-ink-900 border border-ink-800 rounded-3xl overflow-hidden">
              {docs.map((d, i) => {
                const isRealFile = Boolean(d.realFile && d.fileUrl);
                const summary = isRealFile ? d.description || t('documents.realFileReady') : summaryOf(d);
                return (
                  <Fragment key={d.id}>
                    {i > 0 ? <View className="h-px bg-ink-800 mx-4" /> : null}
                    <Pressable
                      onPress={() => onOpen(d)}
                      accessibilityRole="button"
                      accessibilityHint={t('documents.openHint')}
                      className="flex-row items-center gap-3 px-4 py-4 active:bg-ink-800"
                    >
                      <View className="w-14 h-14 rounded-2xl border border-ink-700 items-center justify-center">
                        <Text className="text-ink-300 text-sm font-mono font-bold">
                          {isRealFile ? 'PDF' : d.kind}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text numberOfLines={1} className="text-ink-50 text-lg font-bold">
                          {d.title}
                        </Text>
                        {summary ? (
                          <Text numberOfLines={1} className="text-ink-300 text-sm mt-0.5">
                            {summary}
                          </Text>
                        ) : null}
                      </View>
                      <Badge
                        tone={isRealFile ? 'wait' : 'ok'}
                        label={isRealFile ? t('documents.badge.file') : t('documents.badge.verified')}
                      />
                    </Pressable>
                  </Fragment>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}
