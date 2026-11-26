import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { useTrip, type TripPhase } from '../../features/trip';
import { distanceKm } from '../../utils/geo';
import { receiverLabel, receiverTone } from '../tripUi';

const STEPS = ['pickup', 'driving', 'approaching', 'arrived', 'unloaded'] as const;

function stepIndex(phase: TripPhase): number {
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

/**
 * Cartão da viagem (próxima ou em andamento). É a única parte do Início que acompanha a
 * posição do caminhão: a distância sai arredondada do seletor, então só redesenha quando o
 * número na tela muda.
 */
export function TripCard({ compact }: { compact: boolean }) {
  const { t } = useTranslation();
  const { phase, activeRoute, receiver, etaMin, start } = useTrip(
    useShallow((s) => ({
      phase: s.phase,
      activeRoute: s.activeRoute,
      receiver: s.receiver,
      etaMin: s.etaMin,
      start: s.start,
    })),
  );
  const leftKm = useTrip(
    (s) => Math.round(distanceKm(s.position, s.activeRoute.destination.position) * 10) / 10,
  );
  const idle = phase === 'idle';
  const currentStep = stepIndex(phase);

  return (
    <Card className="p-5">
      <View className="flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <Text
          numberOfLines={compact ? 2 : 1}
          className="shrink text-info-300 text-sm font-bold uppercase tracking-widest"
        >
          {idle ? t('home.nextTrip') : t('home.currentTrip')} · {activeRoute.tripId}
        </Text>
        <Text className="text-brand-300 text-base font-mono font-bold">{activeRoute.plate}</Text>
      </View>

      <View className="mt-4">
        <RouteStop kind="origin" caption={t('trip.originLabel')} name={activeRoute.origin.name} done={!idle} />
        <View className="w-0.5 h-5 bg-ink-700 ml-[9px]" />
        <RouteStop
          kind="destination"
          caption={
            activeRoute.unloadWindow
              ? t('home.windowAndKm', { window: activeRoute.unloadWindow, km: leftKm.toFixed(0) })
              : t('trip.left', { km: leftKm.toFixed(1) })
          }
          name={activeRoute.destination.name}
          done={phase === 'unloaded'}
        />
      </View>

      {idle ? (
        <>
          <Button className="mt-5" label={t('trip.start')} onPress={start} icon={<Icon name="play" size={22} />} />
          <Text className="text-ink-300 text-sm text-center mt-3">{t('home.startHint')}</Text>
        </>
      ) : (
        <>
          <View className="flex-row flex-wrap items-center gap-2 mt-4">
            <Badge tone="brand" label={t(`trip.phase.${phase}`)} />
            <Badge tone={receiverTone(receiver)} label={`${t('trip.receiver')} ${receiverLabel(receiver, t)}`} />
            {etaMin !== null && etaMin > 0 ? <Badge tone="neutral" label={t('map.etaShort', { min: etaMin })} /> : null}
          </View>
          <View
            className="flex-row gap-1.5 mt-4"
            accessible
            accessibilityLabel={t('home.stepProgress', {
              step: currentStep + 1,
              total: STEPS.length,
              name: t(`trip.steps.${STEPS[Math.max(0, currentStep)]}`),
            })}
          >
            {STEPS.map((key, i) => (
              <View key={key} className="flex-1">
                <View
                  className={`h-1.5 rounded-full ${
                    i < currentStep ? 'bg-brand-400' : i === currentStep ? 'bg-wait-500' : 'bg-ink-700'
                  }`}
                />
                {/* Cinco colunas: o rótulo encolhe para caber, sem cortar a palavra. */}
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  className={`text-xs mt-1.5 text-center ${i === currentStep ? 'text-ink-50 font-bold' : 'text-ink-300'}`}
                >
                  {t(`trip.steps.${key}`)}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Card>
  );
}

function RouteStop({
  kind,
  caption,
  name,
  done,
}: {
  kind: 'origin' | 'destination';
  caption: string;
  name: string;
  done: boolean;
}) {
  const marker =
    kind === 'origin'
      ? `border-2 border-brand-400 ${done ? 'bg-brand-400' : 'bg-transparent'}`
      : `border-2 border-wait-500 ${done ? 'bg-wait-500' : 'bg-wait-500/60'}`;
  return (
    <View className="flex-row items-center gap-3">
      <View className={`w-5 h-5 rounded-full ${marker}`} />
      <View className="flex-1">
        <Text className="text-ink-300 text-sm">{caption}</Text>
        {/* Destino é a informação principal da tela: até 2 linhas, nunca "CD N…". */}
        <Text numberOfLines={2} className="text-ink-50 text-xl font-bold leading-7">
          {name}
        </Text>
      </View>
    </View>
  );
}
