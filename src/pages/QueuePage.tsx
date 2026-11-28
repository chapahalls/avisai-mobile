import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle } from 'react-native-svg';
import type { RootStackParams } from '../app/navigation';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { NetworkBanner } from '../components/NetworkBanner';
import { StayCounter, useStaySummary, useTrip } from '../features/trip';
import { useTalkToAvisai } from '../features/voice';
import { colors } from '../lib/theme';
import { hapticTap } from '../utils/haptics';
import { receiverLabel, receiverTone } from './tripUi';
import { useShallow } from 'zustand/react/shallow';

const RING = 132;
const STROKE = 10;

/**
 * Fila no recebedor (mockup `12-fila-recebedor`): doca prevista, estado do aviso ao
 * recebedor e o contador de tempo parado. A lista de outros caminhões do mockup não
 * aparece: o recebedor ainda não informa a fila.
 */
export function QueuePage({ navigation }: NativeStackScreenProps<RootStackParams, 'Queue'>) {
  const { t } = useTranslation();
  const { phase, receiver, activeRoute, quickArrive, quickUnload } = useTrip(
    // Só os campos usados: o simulador grava o relógio a cada 500 ms e a tela não precisa redesenhar.
    useShallow((s) => ({
      phase: s.phase,
      receiver: s.receiver,
      activeRoute: s.activeRoute,
      quickArrive: s.quickArrive,
      quickUnload: s.quickUnload,
    })),
  );
  const stay = useStaySummary();
  const talkToAvisai = useTalkToAvisai();

  const { width } = useWindowDimensions();
  // Anel proporcional à tela: num celular pequeno, 132 dp espremia o anel e cortava o desenho.
  const ring = Math.min(RING, Math.round(width * 0.3));
  const tone = receiverTone(receiver);
  const ringColor =
    tone === 'ok'
      ? colors.ok[500]
      : tone === 'alert'
        ? colors.alert[500]
        : tone === 'brand'
          ? colors.brand[300]
          : colors.wait[500];
  const canArrive = phase === 'driving' || phase === 'approaching' || phase === 'arrived';
  const canUnload = phase === 'waiting';
  const receiverName = activeRoute.destination.receiverName ?? activeRoute.destination.name;

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top', 'bottom']}>
      <NetworkBanner />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            className="w-11 h-11 rounded-full bg-ink-900 border border-ink-800 items-center justify-center active:opacity-80"
          >
            <Icon name="chevronLeft" size={22} />
          </Pressable>
          <View className="flex-1">
            <Text numberOfLines={1} className="text-ink-300 text-sm">
              {activeRoute.destination.name}
            </Text>
            <Text accessibilityRole="header" className="text-ink-50 text-3xl font-display">
              {t('queue.title')}
            </Text>
          </View>
        </View>

        <Card className="p-5 flex-row items-center gap-5">
          <View style={{ width: ring, height: ring, flexShrink: 0 }} className="items-center justify-center">
            <Svg width={ring} height={ring} style={{ position: 'absolute' }}>
              <Circle
                cx={ring / 2}
                cy={ring / 2}
                r={(ring - STROKE) / 2}
                stroke={ringColor}
                strokeWidth={STROKE}
                fill="none"
              />
            </Svg>
            <Icon name={tone === 'ok' ? 'check' : tone === 'alert' ? 'alert' : 'clock'} size={40} color={ringColor} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-ink-300 text-sm">{t('queue.expectedDock')}</Text>
            {receiver.kind === 'confirmed' ? (
              <Text className="text-ink-50 text-3xl font-display mt-1">
                {t('queue.dockAt', { dock: receiver.dock, time: receiver.time })}
              </Text>
            ) : (
              <Text className="text-ink-50 text-xl font-bold mt-1">{receiverLabel(receiver, t)}</Text>
            )}
            <View className="mt-2">
              <Badge tone={tone} lines={2} label={`${t('trip.receiver')} ${receiverName}`} />
            </View>
          </View>
        </Card>

        {stay.active ? (
          <StayCounter />
        ) : (
          <Card className="p-5">
            <Text className="text-ink-50 text-lg font-bold">{t('queue.stoppedTime')}</Text>
            <Text className="text-ink-300 text-sm mt-1 leading-5">{t('queue.stayStartsOnArrival')}</Text>
          </Card>
        )}

        <Text className="text-ink-300 text-sm leading-5">{t('queue.noPositionNote')}</Text>
      </ScrollView>

      <View className="flex-row gap-3 px-4 pt-3 pb-4 border-t border-ink-800">
        <Button
          className="flex-1"
          label={t('map.talkToAvisai')}
          onPress={() => {
            hapticTap();
            talkToAvisai();
          }}
        />
        {canArrive || canUnload ? (
          <Button
            className="flex-1"
            variant="outline"
            label={canUnload ? t('trip.quickActions.unloaded') : t('trip.quickActions.arrived')}
            onPress={() => {
              hapticTap();
              if (canUnload) quickUnload();
              else quickArrive();
            }}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
