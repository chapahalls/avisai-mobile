import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNetwork } from '../services/network';
import { useOutboxStore } from '../features/outbox';

/** Banner fixo: sem rede / rede fraca, com quantos eventos estão na fila. */
export function NetworkBanner() {
  const { t } = useTranslation();
  const quality = useNetwork((s) => s.quality());
  const pending = useOutboxStore((s) => s.pending);
  if (quality === 'online' && pending === 0) return null;
  const bg = quality === 'offline' ? 'bg-alert-500' : quality === 'weak' ? 'bg-wait-500' : 'bg-brand-600';
  return (
    <View className={`${bg} px-4 py-2`}>
      <Text className="text-ink-950 text-sm font-semibold">
        {t(`network.${quality}`)} · {t('network.queue', { count: pending })}
      </Text>
    </View>
  );
}
