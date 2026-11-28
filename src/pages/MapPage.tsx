import { useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { DemoControls, RouteMap, useTrip } from '../features/trip';
import { colors } from '../lib/theme';
import { openDirectionsTo } from '../services/directions';
import { distanceKm } from '../utils/geo';
import { hapticTap } from '../utils/haptics';
import { receiverLabel, receiverTone } from './tripUi';
import { useShallow } from 'zustand/react/shallow';

function clockIn(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60_000);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/** Mapa (mockup `08-mapa`): destino no topo, mapa ao centro e folha com chegada e paradas. */
export function MapPage() {
  const { t } = useTranslation();
  const { phase, position, receiver, activeRoute, etaMin, speedKmh, start } = useTrip(
    // Só os campos usados: o simulador grava o relógio a cada 500 ms e a tela não precisa redesenhar.
    useShallow((s) => ({
      phase: s.phase,
      position: s.position,
      receiver: s.receiver,
      activeRoute: s.activeRoute,
      etaMin: s.etaMin,
      speedKmh: s.speedKmh,
      start: s.start,
    })),
  );
  const [demoOpen, setDemoOpen] = useState(false);

  const leftKm = distanceKm(position, activeRoute.destination.position);
  const eta =
    etaMin !== null ? etaMin : leftKm > 0.3 ? Math.max(1, Math.round((leftKm / 80) * 60)) : 0;
  const moving = phase === 'driving' || phase === 'approaching';
  const speed = speedKmh !== null ? Math.round(speedKmh) : moving ? 80 : 0;
  const tone = receiverTone(receiver);

  const openNavigation = async () => {
    hapticTap();
    const { lat, lng } = activeRoute.destination.position;
    if (!(await openDirectionsTo(lat, lng))) {
      Alert.alert(t('map.navigateErrorTitle'), t('map.navigateError'));
    }
  };

  return (
    <Screen scroll={false}>
      <View className="flex-1">
        {/* Para onde vou */}
        <View className="mx-4 mt-3 mb-3 bg-ink-900 border border-ink-800 rounded-3xl px-4 py-3 flex-row items-center gap-3">
          <View className="flex-1">
            <Text className="text-ink-300 text-sm">{t('map.headingTo')}</Text>
            <Text numberOfLines={1} className="text-ink-50 text-xl font-bold">
              {activeRoute.destination.name}
            </Text>
          </View>
          <Pressable
            onPress={() => setDemoOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('trip.demoButton')}
            className="flex-row items-center gap-1.5 border border-dashed border-ink-700 rounded-full px-3 py-2 active:opacity-80"
          >
            <Icon name="sliders" size={14} color={colors.wait[500]} />
            <Text className="text-ink-50 text-xs font-semibold">{t('trip.demoButton')}</Text>
          </Pressable>
        </View>

        <View className="flex-1 px-4">
          <RouteMap fullScreen />
        </View>

        {/* Folha inferior: chegada, navegar e paradas */}
        <View className="mt-3 bg-ink-900 border-t border-ink-800 rounded-t-[32px] px-5 pt-3 pb-4">
          <View className="w-10 h-1 rounded-full bg-ink-700 self-center mb-3" />
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text
                style={{ fontVariant: ['tabular-nums'] }}
                className="text-ink-50 text-4xl font-display"
                accessibilityLabel={eta > 0 ? t('map.arrivalA11y', { time: clockIn(eta) }) : undefined}
              >
                {eta > 0 ? clockIn(eta) : '—'}
              </Text>
              <Text style={{ fontVariant: ['tabular-nums'] }} className="text-ink-300 text-base">
                {t('map.kmAndMin', { km: leftKm.toFixed(0), min: eta })}
                {speed > 0 ? ` · ${t('map.speedLabel', { kmh: speed })}` : ''}
              </Text>
            </View>
            {phase === 'idle' ? (
              <Button size="sm" label={t('trip.start')} onPress={start} icon={<Icon name="play" size={16} />} />
            ) : (
              <Button
                size="sm"
                label={t('map.navigate')}
                onPress={() => void openNavigation()}
                icon={<Icon name="navigation" size={16} />}
              />
            )}
          </View>

          <View className="mt-4 pr-20">
            <StopRow
              index={1}
              done={phase !== 'idle'}
              title={activeRoute.origin.name}
              subtitle={t('trip.originLabel')}
            />
            <View className="h-px bg-ink-800 my-3" />
            <StopRow
              index={2}
              done={phase === 'unloaded'}
              highlight
              title={activeRoute.destination.name}
              subtitle={`${t('trip.receiver')} ${receiverLabel(receiver, t)}`}
              subtitleTone={tone}
            />
          </View>
        </View>
      </View>

      {/* Painel de simulação (regra E8) */}
      <Modal visible={demoOpen} transparent animationType="slide" onRequestClose={() => setDemoOpen(false)}>
        <View className="flex-1 justify-end bg-ink-950/80">
          <Pressable className="flex-1" onPress={() => setDemoOpen(false)} accessibilityLabel={t('demo.close')} />
          <View className="bg-ink-950 border-t border-ink-800 rounded-t-[32px] px-4 pt-3 pb-8">
            <View className="w-10 h-1 rounded-full bg-ink-700 self-center mb-3" />
            <DemoControls onClose={() => setDemoOpen(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const subtitleColor = {
  ok: 'text-ok-500',
  alert: 'text-alert-500',
  brand: 'text-brand-300',
  wait: 'text-wait-500',
  info: 'text-info-300',
  neutral: 'text-ink-300',
} as const;

function StopRow({
  index,
  done,
  highlight = false,
  title,
  subtitle,
  subtitleTone = 'neutral',
}: {
  index: number;
  done: boolean;
  highlight?: boolean;
  title: string;
  subtitle: string;
  subtitleTone?: keyof typeof subtitleColor;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <View
        className={`w-9 h-9 rounded-full items-center justify-center ${
          highlight ? 'bg-wait-500' : done ? 'bg-brand-500' : 'bg-ink-800'
        }`}
      >
        {done && !highlight ? (
          <Icon name="check" size={18} />
        ) : (
          <Text className={`text-base font-bold ${highlight ? 'text-ink-950' : 'text-ink-50'}`}>{index}</Text>
        )}
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-ink-50 text-lg font-bold">
          {title}
        </Text>
        <Text numberOfLines={1} className={`text-sm ${subtitleColor[subtitleTone]}`}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}
