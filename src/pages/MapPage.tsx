import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import type { MainTabParams } from '../app/navigation';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { DemoControls, RouteMap, useTrip } from '../features/trip';
import { BUSINESS } from '../lib/config';
import { distanceKm } from '../utils/geo';

export function MapPage() {
  const { t } = useTranslation();
  const nav = useNavigation<BottomTabNavigationProp<MainTabParams>>();
  const { phase, position, receiver, activeRoute, etaMin, speedKmh, start } = useTrip();
  const [demoOpen, setDemoOpen] = useState(false);

  const leftKm = distanceKm(position, activeRoute.destination.position);
  const computedEta =
    etaMin !== null
      ? etaMin
      : leftKm > 0.3
        ? Math.max(1, Math.round((leftKm / 80) * 60))
        : 0;
  const activeSpeed =
    speedKmh !== null
      ? speedKmh
      : phase === 'driving' || phase === 'approaching'
        ? 80
        : 0;

  const receiverTone =
    receiver.kind === 'confirmed'
      ? 'ok'
      : receiver.kind === 'no_answer' || receiver.kind === 'not_today'
        ? 'alert'
        : receiver.kind === 'calling'
          ? 'brand'
          : 'wait';

  return (
    <Screen scroll={false}>
      <View className="flex-1 px-4 pt-3 pb-3 gap-2.5">
        {/* Header compacto no topo */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2.5">
            <Text className="text-ink-50 text-lg font-bold tracking-tight">{t('map.title')}</Text>
            <View className="bg-ink-900 border border-ink-700 rounded-lg px-2.5 py-1">
              <Text className="text-ink-300 text-xs font-mono font-bold tracking-wider">
                {activeRoute.plate}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => setDemoOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('trip.demoButton')}
            className="flex-row items-center gap-1.5 bg-ink-900 border border-dashed border-ink-700 active:opacity-80 rounded-full px-3.5 py-2"
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"
                stroke="#F5A524"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text className="text-ink-50 text-xs font-semibold">{t('trip.demoButton')}</Text>
          </Pressable>
        </View>

        {/* Mapa ocupando toda a área central (flex-1) */}
        <RouteMap fullScreen />

        {/* Card inferior compacto estilo Waze / Uber Driver */}
        <Card className="p-3.5">
          {/* Origem -> Destino + Distância restante */}
          <View className="flex-row items-center justify-between gap-2 mb-2.5">
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <View className="w-2 h-2 rounded-full bg-brand-500" />
                <Text numberOfLines={1} className="text-ink-300 text-xs font-medium">
                  {activeRoute.origin.name}
                </Text>
                <Text className="text-ink-700 text-xs">→</Text>
                <View className="w-2 h-2 rounded-full bg-wait-500" />
                <Text numberOfLines={1} className="flex-1 text-ink-50 text-xs font-bold">
                  {activeRoute.destination.name}
                </Text>
              </View>
              <Text className="text-ink-300 text-[11px] mt-0.5">
                {t(`trip.phase.${phase}`)} ·{' '}
                {t('map.geofenceBadge', {
                  meters: BUSINESS.geofenceMeters,
                  km: BUSINESS.approachKm,
                })}
                {activeSpeed > 0 ? ` · ${t('map.speedLabel', { kmh: activeSpeed })}` : ''}
              </Text>
            </View>

            <View className="bg-brand-500/15 border border-brand-500/40 rounded-xl px-2.5 py-1.5 items-end">
              <Text
                style={{ fontVariant: ['tabular-nums'] }}
                className="text-brand-500 text-xs font-bold"
              >
                {t('trip.left', { km: leftKm.toFixed(1) })}
              </Text>
              {computedEta > 0 && (
                <Text
                  style={{ fontVariant: ['tabular-nums'] }}
                  className="text-ink-300 text-[10px] font-semibold mt-0.5"
                >
                  {t('map.etaShort', { min: computedEta })}
                </Text>
              )}
            </View>
          </View>

          {/* Status do recebedor + Ação rápida (Iniciar viagem ou Falar com AvisAI) */}
          <View className="flex-row items-center justify-between gap-2 pt-2.5 border-t border-ink-700/70">
            <View className="flex-1">
              <Text className="text-ink-300 text-[11px] mb-1">
                {t('trip.receiver')} {activeRoute.destination.receiverName ?? activeRoute.destination.name}
              </Text>
              <View className="self-start">
                <Badge
                  tone={receiverTone}
                  label={
                    receiver.kind === 'confirmed'
                      ? t('trip.receiverStatus.confirmed', {
                          dock: receiver.dock,
                          time: receiver.time,
                        })
                      : t(`trip.receiverStatus.${receiver.kind}`)
                  }
                />
              </View>
            </View>

            {phase === 'idle' ? (
              <Button
                label={t('trip.start')}
                onPress={start}
                icon={
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M5 3l14 9-14 9V3Z"
                      fill="#F4F6FA"
                      stroke="#F4F6FA"
                      strokeWidth={1.8}
                      strokeLinejoin="round"
                    />
                  </Svg>
                }
              />
            ) : (
              <Pressable
                onPress={() => nav.navigate('Trip')}
                accessibilityRole="button"
                className="flex-row items-center gap-1.5 bg-brand-500 active:opacity-85 rounded-xl px-3.5 py-2.5"
              >
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2"
                    stroke="#F4F6FA"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
                <Text className="text-ink-50 text-xs font-bold">{t('map.talkToAvisai')}</Text>
              </Pressable>
            )}
          </View>
        </Card>
      </View>

      {/* Modal Bottom Sheet de Simulação (Regra E8) */}
      <Modal
        visible={demoOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDemoOpen(false)}
      >
        <View className="flex-1 justify-end bg-ink-950/75">
          <Pressable
            className="flex-1"
            onPress={() => setDemoOpen(false)}
            accessibilityLabel={t('demo.close')}
          />
          <View className="bg-ink-950 border-t border-ink-700 rounded-t-3xl px-4 pt-3 pb-8">
            <View className="w-10 h-1 rounded-full bg-ink-700 self-center mb-3" />
            <DemoControls onClose={() => setDemoOpen(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
