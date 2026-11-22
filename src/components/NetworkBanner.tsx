import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { useNetwork } from '../services/network';
import { useOutboxStore } from '../features/outbox';

/** Banner fixo: sem rede / rede fraca, com quantos eventos estão na fila. */
export function NetworkBanner() {
  const { t } = useTranslation();
  const quality = useNetwork((s) => s.quality());
  const pending = useOutboxStore((s) => s.pending);
  if (quality === 'online' && pending === 0) return null;

  const isOffline = quality === 'offline';
  const isWeak = quality === 'weak';

  const bg = isOffline
    ? 'bg-alert-500/95 border-b border-alert-500'
    : isWeak
      ? 'bg-wait-500/95 border-b border-wait-500'
      : 'bg-brand-600/95 border-b border-brand-500';

  const textColor = isOffline || !isWeak ? '#F4F6FA' : '#0B1220';
  const textClass = isWeak ? 'text-ink-950' : 'text-ink-50';

  return (
    <View className={`${bg} px-4 py-2 flex-row items-center justify-between`}>
      <View className="flex-row items-center gap-2 flex-1 pr-2">
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          {isOffline ? (
            <Path
              d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-3.2-2.1M12 20h.01"
              stroke={textColor}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <Path
              d="M5 12.55a11 11 0 0 1 14.08 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"
              stroke={textColor}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </Svg>
        <Text numberOfLines={1} className={`${textClass} text-xs font-bold`}>
          {t(`network.${quality}`)}
        </Text>
      </View>
      <View
        className={`px-2 py-0.5 rounded-full ${
          isWeak ? 'bg-ink-950/15' : 'bg-ink-950/30'
        }`}
      >
        <Text className={`${textClass} text-xs font-semibold`}>
          {t('network.queue', { count: pending })}
        </Text>
      </View>
    </View>
  );
}
