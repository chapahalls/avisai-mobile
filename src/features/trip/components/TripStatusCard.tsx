import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { Card } from '../../../components/Card';
import { Badge } from '../../../components/Badge';
import { useTrip } from '../hooks/useTrip';
import { distanceKm } from '../../../utils/geo';
import type { TripPhase } from '../types';

const STEPS: { key: 'pickup' | 'driving' | 'approaching' | 'arrived' | 'unloaded' }[] = [
  { key: 'pickup' },
  { key: 'driving' },
  { key: 'approaching' },
  { key: 'arrived' },
  { key: 'unloaded' },
];

function phaseToStepIndex(phase: TripPhase): number {
  switch (phase) {
    case 'idle':
      return -1;
    case 'pickup':
      return 0;
    case 'driving':
      return 1;
    case 'approaching':
      return 2;
    case 'arrived':
    case 'waiting':
      return 3;
    case 'unloaded':
      return 4;
  }
}

export function TripStatusCard() {
  const { t } = useTranslation();
  const { phase, position, receiver, activeRoute } = useTrip();
  const left = distanceKm(position, activeRoute.destination.position);
  const currentStep = phaseToStepIndex(phase);

  const receiverTone =
    receiver.kind === 'confirmed'
      ? 'ok'
      : receiver.kind === 'no_answer' || receiver.kind === 'not_today'
        ? 'alert'
        : receiver.kind === 'calling'
          ? 'brand'
          : 'wait';

  return (
    <Card>
      {/* Header do status */}
      <View className="flex-row justify-between items-center mb-3">
        <View>
          <Text className="text-ink-50 text-lg font-bold tracking-tight">
            {t(`trip.phase.${phase}`)}
          </Text>
          <Text className="text-ink-300 text-xs mt-0.5">
            {t('trip.left', { km: left.toFixed(1) })}
          </Text>
        </View>
        <View className="bg-ink-800 border border-ink-700 rounded-lg px-2.5 py-1">
          <Text className="text-ink-50 text-xs font-mono font-bold tracking-wider">
            {activeRoute.plate}
          </Text>
        </View>
      </View>

      {/* Stepper horizontal de 5 etapas */}
      <View className="my-2">
        <View className="flex-row items-center">
          {STEPS.map((step, idx) => {
            const isDone = phase === 'unloaded' || idx < currentStep;
            const isCurrent = phase !== 'unloaded' && idx === currentStep;

            return (
              <View key={step.key} className="flex-1 flex-row items-center">
                <View className="items-center flex-1">
                  <View className="flex-row items-center w-full">
                    {/* Linha esquerda */}
                    <View
                      className={`flex-1 h-0.5 ${
                        idx === 0
                          ? 'bg-transparent'
                          : idx <= currentStep
                            ? 'bg-ok-500'
                            : 'bg-ink-700'
                      }`}
                    />
                    {/* Bolinha */}
                    <View
                      className={`w-6 h-6 rounded-full items-center justify-center ${
                        isDone
                          ? 'bg-ok-500'
                          : isCurrent
                            ? 'bg-brand-500 border-2 border-brand-50'
                            : 'bg-ink-800 border border-ink-700'
                      }`}
                    >
                      {isDone ? (
                        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                          <Path
                            d="M20 6L9 17l-5-5"
                            stroke="#0B1220"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      ) : (
                        <View
                          className={`w-2 h-2 rounded-full ${
                            isCurrent ? 'bg-ink-50' : 'bg-ink-700'
                          }`}
                        />
                      )}
                    </View>
                    {/* Linha direita */}
                    <View
                      className={`flex-1 h-0.5 ${
                        idx === STEPS.length - 1
                          ? 'bg-transparent'
                          : idx < currentStep
                            ? 'bg-ok-500'
                            : 'bg-ink-700'
                      }`}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    className={`text-[11px] mt-1.5 font-semibold ${
                      isCurrent
                        ? 'text-brand-500'
                        : isDone
                          ? 'text-ok-500'
                          : 'text-ink-300'
                    }`}
                  >
                    {t(`trip.steps.${step.key}`)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Linha do recebedor */}
      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-ink-700/70">
        <View className="flex-row items-center gap-2 flex-1 pr-2">
          <View className="w-7 h-7 rounded-lg bg-ink-800 border border-ink-700 items-center justify-center">
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92Z"
                stroke="#A7B1C6"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <View className="flex-1">
            <Text className="text-ink-300 text-xs">{t('trip.receiver')}</Text>
            <Text numberOfLines={1} className="text-ink-50 text-xs font-semibold">
              {activeRoute.destination.receiverName ?? activeRoute.destination.name}
            </Text>
          </View>
        </View>
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
