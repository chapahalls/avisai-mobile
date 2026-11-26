import { Alert, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '../../components/Button';
import { Icon, type IconName } from '../../components/Icon';
import { SectionLabel } from '../../components/ScreenTitle';
import { useTrip } from '../../features/trip';
import { colors } from '../../lib/theme';
import { hapticTap } from '../../utils/haptics';

/*
 * Partes do Início, cada uma com o próprio seletor da viagem: o simulador grava o relógio
 * e a posição a cada 500 ms e só a parte que mostra aquele dado redesenha.
 */

/** Avisos que pedem atenção: rota nova do CCO e GPS divergente. */
export function HomeNotices() {
  const { t } = useTranslation();
  const { routeAssignedBanner, gpsDivergence, clearRouteAssignedBanner, setGpsDivergence } = useTrip(
    useShallow((s) => ({
      routeAssignedBanner: s.routeAssignedBanner,
      gpsDivergence: s.gpsDivergence,
      clearRouteAssignedBanner: s.clearRouteAssignedBanner,
      setGpsDivergence: s.setGpsDivergence,
    })),
  );
  return (
    <>
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
    </>
  );
}

const shortcutTone = {
  info: { box: 'bg-info-900', color: colors.info[300] },
  wait: { box: 'bg-wait-500/20', color: colors.wait[500] },
  neutral: { box: 'bg-ink-800', color: colors.ink[300] },
} as const;

/** Atalhos: três colunas; em tela apertada, uma lista (senão as palavras quebram no meio). */
export function HomeShortcuts({
  compact,
  onMessages,
  onQueue,
  onMap,
}: {
  compact: boolean;
  onMessages: () => void;
  onQueue: () => void;
  onMap: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className={compact ? 'gap-3' : 'flex-row gap-3'}>
      <Shortcut
        compact={compact}
        icon="message"
        tone="info"
        title={t('home.shortcuts.cco.title')}
        subtitle={t('home.shortcuts.cco.subtitle')}
        onPress={onMessages}
      />
      <Shortcut
        compact={compact}
        icon="list"
        tone="wait"
        title={t('home.shortcuts.queue.title')}
        subtitle={t('home.shortcuts.queue.subtitle')}
        onPress={onQueue}
      />
      <Shortcut
        compact={compact}
        icon="map"
        tone="neutral"
        title={t('home.shortcuts.map.title')}
        subtitle={t('home.shortcuts.map.subtitle')}
        onPress={onMap}
      />
    </View>
  );
}

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
        <Text className="text-ink-300 text-sm mt-1 leading-5">{subtitle}</Text>
      </View>
    </Pressable>
  );
}

/** Recado do CCO ("A central pergunta…"). */
export function CentralRequestCard() {
  const { t } = useTranslation();
  const centralRequest = useTrip((s) => s.centralRequest);
  const setCentralRequest = useTrip((s) => s.setCentralRequest);
  if (!centralRequest) return null;
  return (
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
          className="self-start mt-1 min-h-12 justify-center active:opacity-70"
        >
          <Text className="text-info-300 text-sm font-semibold">{t('trip.centralRequest.dismiss')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Ações de um toque, só quando fazem sentido na fase. */
export function QuickActions() {
  const { t } = useTranslation();
  const { phase, quickArrive, quickReportQueue, quickUnload } = useTrip(
    useShallow((s) => ({
      phase: s.phase,
      quickArrive: s.quickArrive,
      quickReportQueue: s.quickReportQueue,
      quickUnload: s.quickUnload,
    })),
  );
  const canQuickArrive = phase === 'driving' || phase === 'approaching' || phase === 'arrived';
  const canQuickReportQueue = phase !== 'idle' && phase !== 'unloaded';
  const canQuickUnload = phase === 'waiting';
  if (!canQuickArrive && !canQuickReportQueue && !canQuickUnload) return null;

  return (
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
  );
}

/** Viagem encerrada: recomeçar, com confirmação. */
export function RestartTrip() {
  const { t } = useTranslation();
  const phase = useTrip((s) => s.phase);
  const reset = useTrip((s) => s.reset);
  if (phase !== 'unloaded') return null;
  const confirm = () => {
    hapticTap();
    Alert.alert(t('trip.confirmReset.title'), t('trip.confirmReset.message'), [
      { text: t('trip.confirmReset.cancel'), style: 'cancel' },
      { text: t('trip.confirmReset.confirm'), style: 'destructive', onPress: () => reset() },
    ]);
  };
  return <Button label={t('trip.restart')} variant="outline" onPress={confirm} />;
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
