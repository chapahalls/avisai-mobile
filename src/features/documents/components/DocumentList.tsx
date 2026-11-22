import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path, Rect } from 'react-native-svg';
import { Badge } from '../../../components/Badge';
import { useDocuments } from '../hooks/useDocuments';
import type { TripDocument } from '../types';

export function DocumentList({ onOpen }: { onOpen: (d: TripDocument) => void }) {
  const { t } = useTranslation();
  const documents = useDocuments((s) => s.documents);

  return (
    <View className="gap-3">
      {documents.map((d) => {
        const isNfe = d.kind === 'NF-e';
        const isRealFile = Boolean(d.realFile && d.fileUrl);
        const accentColor = isNfe ? '#099DFD' : isRealFile ? '#F5A524' : '#17B26A';
        const iconBg = isNfe
          ? 'bg-brand-500/15 border-brand-500/40'
          : isRealFile
            ? 'bg-wait-500/15 border-wait-500/40'
            : 'bg-ok-500/15 border-ok-500/40';
        const previewEntries = Object.entries(d.fields).slice(0, 3);

        return (
          <Pressable
            key={d.id}
            onPress={() => onOpen(d)}
            accessibilityRole="button"
            className="bg-ink-900 border border-ink-700/80 active:opacity-85 rounded-2xl p-4"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1 pr-2">
                <View className={`w-11 h-11 rounded-xl border items-center justify-center ${iconBg}`}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Rect
                      x={5}
                      y={3}
                      width={14}
                      height={18}
                      rx={2.5}
                      stroke={accentColor}
                      strokeWidth={2}
                    />
                    <Path
                      d="M9 8h6M9 12h6M9 16h4"
                      stroke={accentColor}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  </Svg>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-ink-50 text-base font-bold">{d.title}</Text>
                    <Badge tone={isNfe ? 'brand' : isRealFile ? 'wait' : 'ok'} label={d.kind} />
                  </View>
                  <Text className="text-ink-300 text-xs mt-0.5">
                    {isRealFile
                      ? t('documents.realFileReady')
                      : t('documents.extractedFields', { count: Object.keys(d.fields).length })}
                  </Text>
                </View>
              </View>

              {/* Seta chevron à direita */}
              <View className="w-8 h-8 rounded-full bg-ink-800 border border-ink-700 items-center justify-center">
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 18l6-6-6-6"
                    stroke="#A7B1C6"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </View>

            {/* Pílulas de prévia dos principais campos extraídos */}
            <View className="flex-row flex-wrap gap-1.5 mt-3 pt-3 border-t border-ink-700/70">
              {previewEntries.map(([k, v]) => (
                <View
                  key={k}
                  className="bg-ink-800/90 border border-ink-700/80 rounded-lg px-2.5 py-1 flex-row items-center gap-1"
                >
                  <Text className="text-ink-300 text-[11px] font-medium">
                    {t(`documents.fieldLabels.${k}`, k)}:
                  </Text>
                  <Text numberOfLines={1} className="text-ink-50 text-[11px] font-semibold max-w-[160px]">
                    {v}
                  </Text>
                </View>
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
