import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { MainTabParams, RootStackParams } from '../app/navigation';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Icon, type IconName } from '../components/Icon';
import { RodarMark } from '../components/RodarLogo';
import { Screen } from '../components/Screen';
import { SectionLabel } from '../components/ScreenTitle';
import { useSession } from '../features/auth';
import { JourneyTimeline, StayCounter, useTrip, type TripPhase } from '../features/trip';
import { useAvisaiDock, useVoice } from '../features/voice';
import { colors } from '../lib/theme';
import { useWakeWord } from '../services/wakeWord';
import { distanceKm } from '../utils/geo';
import { hapticTap } from '../utils/haptics';
import { useCompactLayout } from '../utils/layout';
import { SettingsSheet } from './SettingsSheet';
import { receiverLabel, receiverTone } from './tripUi';

type HomeNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParams, 'Trip'>,
  NativeStackNavigationProp<RootStackParams>
>;

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

function greetingKey(
  date: Date,
): 'home.greeting.morning' | 'home.greeting.afternoon' | 'home.greeting.evening' {
  const h = date.getHours();
  if (h < 12) return 'home.greeting.morning';
  if (h < 18) return 'home.greeting.afternoon';
  return 'home.greeting.evening';
}

/** Início (mockup `03-home`): saudação, viagem, atalhos, recado do CCO, espera e jornada. */
export function TripPage() {
  const { t } = useTranslation();
  const nav = useNavigation<HomeNav>();
  const {
    phase,
    position,
    activeRoute,
    receiver,
    etaMin,
    centralRequest,
    gpsDivergence,
    routeAssignedBanner,
    start,
    reset,
    quickArrive,
    quickReportQueue,
    quickUnload,
    setCentralRequest,
    setGpsDivergence,
    clearRouteAssignedBanner,
  } = useTrip();
  const voiceState = useVoice((s) => s.state);
  const wakeListening = useWakeWord((s) => s.status === 'listening');
  const compact = useCompactLayout();
  const session = useSession((s) => s.session);
  const openPanel = useAvisaiDock((s) => s.openPanel);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const driverName = session?.name || activeRoute.driverName || t('auth.demoDriverName');
  const firstName = driverName.trim().split(/\s+/)[0] || driverName;
  const leftKm = distanceKm(position, activeRoute.destination.position);
  const idle = phase === 'idle';
  const currentStep = stepIndex(phase);

  const canQuickArrive = phase === 'driving' || phase === 'approaching' || phase === 'arrived';
  const canQuickReportQueue = phase !== 'idle' && phase !== 'unloaded';
  const canQuickUnload = phase === 'waiting';

  const handleConfirmReset = () => {
    hapticTap();
    Alert.alert(t('trip.confirmReset.title'), t('trip.confirmReset.message'), [
      { text: t('trip.confirmReset.cancel'), style: 'cancel' },
      { text: t('trip.confirmReset.confirm'), style: 'destructive', onPress: () => reset() },
    ]);
  };

  const avisaiPill = (
    <Pressable
      onPress={() => {
        hapticTap();
        openPanel();
      }}
      accessibilityRole="button"
      accessibilityHint={t('voice.dock.openHint')}
      className="flex-row items-center gap-2 bg-ink-900 border border-ink-800 rounded-full px-3.5 py-2 active:opacity-80"
    >
      <View
        className={`w-2.5 h-2.5 rounded-full ${
          voiceState !== 'idle' ? 'bg-ok-500' : wakeListening ? 'bg-brand-400' : 'bg-ink-300'
        }`}
      />
      <Text className="text-ink-50 text-sm font-semibold">
        {voiceState === 'idle' && wakeListening
          ? t('voice.wake.listening')
          : t('home.avisaiState', { state: t(`voice.state.${voiceState}`) })}
      </Text>
    </Pressable>
  );

  return (
    <Screen>
      {/* Cabeçalho: símbolo, saudação e estado do AvisAI */}
      <View className="flex-row items-center gap-3">
        <RodarMark size={48} />
        <View className="flex-1 min-w-0">
          <Text numberOfLines={1} className="text-ink-300 text-base">
            {t(greetingKey(new Date()))}
          </Text>
          <Text numberOfLines={1} className="text-ink-50 text-2xl font-display">
            {firstName}
          </Text>
        </View>
        {compact ? null : avisaiPill}
        <Pressable
          onPress={() => {
            hapticTap();
            setSettingsOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
          className="w-11 h-11 rounded-full bg-ink-900 border border-ink-800 items-center justify-center active:opacity-80"
        >
          <Icon name="sliders" size={20} color={colors.ink[300]} />
        </Pressable>
      </View>

      {/* Tela apertada: o estado do AvisAI desce para a linha de baixo. */}
      {compact ? <View className="flex-row">{avisaiPill}</View> : null}

      {/* Avisos que pedem atenção */}
      {routeAssignedBanner ? (
        <Notice
          tone="brand"
          title={t('trip.routeAssignedBanner.title')}
          body={routeAssignedBanner}
          action={t('trip.routeAssignedBanner.dismiss')}
          onAction={clearRouteAssignedBanner}
        />
      ) : null}
      {gpsDivergence ? (
        <Notice
          tone="alert"
          title={t('trip.gpsDivergence.title')}
          body={gpsDivergence}
          action={t('trip.gpsDivergence.dismiss')}
          onAction={() => setGpsDivergence(null)}
        />
      ) : null}

      {/* Próxima viagem / viagem em andamento */}
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
          <RouteStop
            kind="origin"
            caption={t('trip.originLabel')}
            name={activeRoute.origin.name}
            done={!idle}
          />
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
            <Button
              className="mt-5"
              label={t('trip.start')}
              onPress={start}
              icon={<Icon name="play" size={22} />}
            />
            <Text className="text-ink-300 text-sm text-center mt-3">{t('home.startHint')}</Text>
          </>
        ) : (
          <>
            <View className="flex-row flex-wrap items-center gap-2 mt-4">
              <Badge tone="brand" label={t(`trip.phase.${phase}`)} />
              <Badge
                tone={receiverTone(receiver)}
                label={`${t('trip.receiver')} ${receiverLabel(receiver, t)}`}
              />
              {etaMin !== null && etaMin > 0 ? (
                <Badge tone="neutral" label={t('map.etaShort', { min: etaMin })} />
              ) : null}
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
                  <Text
                    numberOfLines={1}
                    className={`text-[11px] mt-1.5 text-center ${
                      i === currentStep ? 'text-ink-50 font-bold' : 'text-ink-300'
                    }`}
                  >
                    {t(`trip.steps.${key}`)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Card>

      {/* Atalhos: três colunas; em tela apertada, uma lista (senão as palavras quebram no meio). */}
      <View className={compact ? 'gap-3' : 'flex-row gap-3'}>
        <Shortcut
          compact={compact}
          icon="message"
          tone="info"
          title={t('home.shortcuts.cco.title')}
          subtitle={t('home.shortcuts.cco.subtitle')}
          onPress={() => nav.navigate('Messages')}
        />
        <Shortcut
          compact={compact}
          icon="list"
          tone="wait"
          title={t('home.shortcuts.queue.title')}
          subtitle={t('home.shortcuts.queue.subtitle')}
          onPress={() => nav.navigate('Queue')}
        />
        <Shortcut
          compact={compact}
          icon="map"
          tone="neutral"
          title={t('home.shortcuts.map.title')}
          subtitle={t('home.shortcuts.map.subtitle')}
          onPress={() => nav.navigate('Map')}
        />
      </View>

      {/* Recado do CCO */}
      {centralRequest ? (
        <View className="bg-info-900 rounded-3xl p-4 flex-row gap-3">
          <View className="w-12 h-12 rounded-full bg-info-300/20 items-center justify-center">
            <Text className="text-ink-50 text-sm font-bold">CCO</Text>
          </View>
          <View className="flex-1">
            <Text className="text-info-300 text-sm font-bold">
              {centralRequest.status === 'respondida'
                ? t('trip.centralRequest.answeredTitle')
                : t('trip.centralRequest.title')}
            </Text>
            {centralRequest.pergunta ? (
              <Text className="text-ink-50 text-lg mt-1 leading-6">“{centralRequest.pergunta}”</Text>
            ) : null}
            <Text
              className={`text-sm mt-1.5 ${
                centralRequest.status === 'respondida' ? 'text-ink-300' : 'text-wait-500 font-semibold'
              }`}
            >
              {centralRequest.status === 'respondida' && centralRequest.resposta
                ? centralRequest.resposta
                : t('trip.centralRequest.voiceHint')}
            </Text>
            <Pressable
              onPress={() => setCentralRequest(null)}
              accessibilityRole="button"
              className="self-start mt-2 py-1 active:opacity-70"
            >
              <Text className="text-info-300 text-sm font-semibold">
                {t('trip.centralRequest.dismiss')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <StayCounter />

      {/* Ações de um toque, só quando fazem sentido na fase */}
      {canQuickArrive || canQuickReportQueue || canQuickUnload ? (
        <View className="gap-2">
          <SectionLabel>{t('trip.quickActions.label')}</SectionLabel>
          <View className="flex-row flex-wrap gap-2">
            {canQuickArrive ? (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                label={t('trip.quickActions.arrived')}
                onPress={() => {
                  hapticTap();
                  quickArrive();
                }}
              />
            ) : null}
            {canQuickReportQueue ? (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                label={t('trip.quickActions.reportQueue')}
                onPress={() => {
                  hapticTap();
                  quickReportQueue();
                }}
              />
            ) : null}
            {canQuickUnload ? (
              <Button
                size="sm"
                className="flex-1"
                label={t('trip.quickActions.unloaded')}
                onPress={() => {
                  hapticTap();
                  quickUnload();
                }}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      <JourneyTimeline />

      {phase === 'unloaded' ? (
        <Button label={t('trip.restart')} variant="outline" onPress={handleConfirmReset} />
      ) : null}

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Screen>
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
        <Text numberOfLines={1} className="text-ink-50 text-xl font-bold">
          {name}
        </Text>
      </View>
    </View>
  );
}

const shortcutTone = {
  info: { box: 'bg-info-900', color: colors.info[300] },
  wait: { box: 'bg-wait-500/20', color: colors.wait[500] },
  neutral: { box: 'bg-ink-800', color: colors.ink[300] },
} as const;

function Shortcut({
  compact,
  icon,
  tone,
  title,
  subtitle,
  onPress,
}: {
  compact: boolean;
  icon: IconName;
  tone: keyof typeof shortcutTone;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      className={`bg-ink-900 border border-ink-800 rounded-3xl p-3.5 active:opacity-80 ${
        compact ? 'flex-row items-center gap-3' : 'flex-1'
      }`}
    >
      <View className={`w-11 h-11 rounded-xl items-center justify-center ${shortcutTone[tone].box}`}>
        <Icon name={icon} size={22} color={shortcutTone[tone].color} />
      </View>
      <View className={compact ? 'flex-1' : undefined}>
        <Text className={`text-ink-50 text-base font-bold leading-5 ${compact ? '' : 'mt-3'}`}>{title}</Text>
        <Text className="text-ink-300 text-xs mt-1 leading-4">{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function Notice({
  tone,
  title,
  body,
  action,
  onAction,
}: {
  tone: 'brand' | 'alert';
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  const box = tone === 'alert' ? 'bg-alert-500/15' : 'bg-brand-500/20';
  const titleColor = tone === 'alert' ? 'text-alert-500' : 'text-brand-300';
  return (
    <View accessibilityRole="alert" className={`rounded-3xl p-4 flex-row items-center gap-3 ${box}`}>
      <Icon name="alert" size={22} color={tone === 'alert' ? colors.alert[500] : colors.brand[300]} />
      <View className="flex-1">
        <Text className={`text-sm font-bold ${titleColor}`}>{title}</Text>
        <Text className="text-ink-50 text-sm mt-0.5">{body}</Text>
      </View>
      <Button size="sm" variant="outline" label={action} onPress={onAction} />
    </View>
  );
}
