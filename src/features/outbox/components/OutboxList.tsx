import { FlatList, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useOutboxStore } from '../hooks/useOutbox';
import { Badge } from '../../../components/Badge';

const tone = { pending: 'wait', sending: 'brand', sent: 'ok', failed: 'alert' } as const;

export function OutboxList() {
  const { t } = useTranslation();
  const rows = useOutboxStore((s) => s.rows);
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.id}
      ListEmptyComponent={<Text className="text-ink-300 text-center mt-8">{t('outbox.empty')}</Text>}
      renderItem={({ item }) => (
        <View className="bg-ink-900 border border-ink-700 rounded-card p-3 mb-2 flex-row items-center justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-ink-50 font-semibold">{t(`events.${item.type}`, item.type)}</Text>
            <Text className="text-ink-300 text-xs">
              {new Date(item.created_at).toLocaleTimeString()} · {t('outbox.attempts', { n: item.attempts })}
            </Text>
          </View>
          <Badge tone={tone[item.status]} label={t(`outbox.status.${item.status}`)} />
        </View>
      )}
    />
  );
}
