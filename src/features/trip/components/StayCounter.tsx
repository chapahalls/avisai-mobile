import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/Card';
import { useTrip } from '../hooks/useTrip';
import { computeStay } from '../rules/stay';
import { brl, hhmm } from '../../../utils/format';
import { BUSINESS } from '../../../lib/config';

/** Contador de espera: começa no check-in de chegada, mostra franquia restante e estadia acumulada. */
export function StayCounter() {
  const { t } = useTranslation();
  const { phase, simMinutes, arrivedAtMin, ccoAttempts, ccoAcknowledged } = useTrip();
  if (arrivedAtMin === null || (phase !== 'waiting' && phase !== 'unloaded')) return null;
  const stay = computeStay(simMinutes - arrivedAtMin);
  const over = stay.excessHours > 0;
  return (
    <Card>
      <Text className="text-ink-300 text-sm">{t('stay.waiting')}</Text>
      <Text className={`text-5xl font-bold mt-1 ${over ? 'text-wait-500' : 'text-ink-50'}`}>{hhmm(stay.waitedMinutes)}</Text>
      <Text className="text-ink-300 text-sm mt-1">
        {over ? t('stay.value', { value: brl(stay.value) }) : t('stay.franchiseLeft', { left: hhmm(stay.franchiseLeftMinutes) })}
      </Text>
      <View className="flex-row mt-3 gap-1">
        {Array.from({ length: BUSINESS.maxCcoAttempts }).map((_, i) => (
          <View key={i} className={`flex-1 h-2 rounded-full ${i < ccoAttempts ? (ccoAcknowledged ? 'bg-ok-500' : 'bg-alert-500') : 'bg-ink-700'}`} />
        ))}
      </View>
      <Text className="text-ink-300 text-xs mt-1">
        {ccoAcknowledged ? t('stay.ccoAck') : t('stay.ccoAttempts', { n: ccoAttempts, max: BUSINESS.maxCcoAttempts })}
      </Text>
    </Card>
  );
}
