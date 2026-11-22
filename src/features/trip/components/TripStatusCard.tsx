import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/Card';
import { Badge } from '../../../components/Badge';
import { ROUTE } from '../api/route.mock';
import { useTrip } from '../hooks/useTrip';
import { distanceKm } from '../../../utils/geo';

export function TripStatusCard() {
  const { t } = useTranslation();
  const { phase, position, receiver } = useTrip();
  const left = distanceKm(position, ROUTE.destination.position);
  const receiverTone =
    receiver.kind === 'confirmed' ? 'ok' : receiver.kind === 'no_answer' || receiver.kind === 'not_today' ? 'alert' : 'wait';
  return (
    <Card>
      <View className="flex-row justify-between items-center">
        <Text className="text-ink-50 text-lg font-semibold">{t(`trip.phase.${phase}`)}</Text>
        <Text className="text-ink-300 text-sm">{ROUTE.plate}</Text>
      </View>
      <Text className="text-ink-300 text-sm mt-1">{t('trip.left', { km: left.toFixed(1) })}</Text>
      <View className="flex-row items-center mt-3 gap-2">
        <Text className="text-ink-300 text-sm">{t('trip.receiver')}</Text>
        <Badge
          tone={receiverTone}
          label={
            receiver.kind === 'confirmed'
              ? t('trip.receiverStatus.confirmed', { dock: receiver.dock, time: receiver.time })
              : t(`trip.receiverStatus.${receiver.kind}`)
          }
        />
      </View>
    </Card>
  );
}
