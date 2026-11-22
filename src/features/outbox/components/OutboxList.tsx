import { FlatList, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import { useOutboxStore } from '../hooks/useOutbox';
import { Badge } from '../../../components/Badge';
import { formatTime } from '../../../utils/format';

const tone = { pending: 'wait', sending: 'brand', sent: 'ok', failed: 'alert' } as const;

const dotColor = {
  pending: 'bg-wait-500',
  sending: 'bg-brand-500',
  sent: 'bg-ok-500',
  failed: 'bg-alert-500',
} as const;

function shortIdempotencyKey(key: string): string {
  if (!key) return '';
  if (key.length <= 14) return key;
  return `${key.slice(0, 6)}…${key.slice(-6)}`;
}

export function OutboxList() {
  const { t } = useTranslation();
  const rows = useOutboxStore((s) => s.rows);

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.id}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View className="bg-ink-900/70 border border-ink-800 rounded-2xl p-6 mt-4 items-center">
          <View className="w-11 h-11 rounded-full bg-ok-500/15 border border-ok-500/40 items-center justify-center mb-2.5">
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={9} stroke="#17B26A" strokeWidth={2} />
              <Path
                d="M8.5 12.5l2.5 2.5 4.5-5"
                stroke="#17B26A"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text className="text-ink-50 text-sm font-bold text-center">{t('outbox.empty')}</Text>
          <Text className="text-ink-300 text-xs text-center mt-1 leading-4">
            {t('outbox.emptyHint')}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View className="bg-ink-900 border border-ink-700/80 rounded-2xl p-3.5 mb-2.5 flex-row items-center justify-between">
          <View className="flex-row items-start gap-2.5 flex-1 pr-2">
            <View className={`w-2.5 h-2.5 rounded-full mt-1.5 ${dotColor[item.status]}`} />
            <View className="flex-1">
              <Text className="text-ink-50 text-sm font-bold">
                {t(`events.${item.type}`, item.type)}
              </Text>
              <View className="flex-row flex-wrap items-center gap-1.5 mt-1">
                <Text
                  style={{ fontVariant: ['tabular-nums'] }}
                  className="text-ink-300 text-xs"
                >
                  {formatTime(item.created_at)}
                </Text>
                <Text className="text-ink-700 text-xs">·</Text>
                <Text className="text-ink-300 text-xs">
                  {t('outbox.attempts', { n: item.attempts })}
                </Text>
                {item.idempotency_key ? (
                  <View className="bg-ink-800 border border-ink-700 rounded px-1.5 py-0.5">
                    <Text className="text-ink-300 text-[10px] font-mono">
                      {t('outbox.idempotencyPrefix')}: {shortIdempotencyKey(item.idempotency_key)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
          <Badge tone={tone[item.status]} label={t(`outbox.status.${item.status}`)} />
        </View>
      )}
    />
  );
}
