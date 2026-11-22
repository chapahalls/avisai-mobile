import { useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import type { MainTabParams } from '../app/navigation';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useSession } from '../features/auth';
import {
  DemoControls,
  JourneyTimeline,
  StayCounter,
  TripStatusCard,
  computeStay,
  useTrip,
} from '../features/trip';
import {
  CabinModeModal,
  MicButton,
  QuickUtterances,
  Transcript,
  VoiceStateIndicator,
  useVoice,
} from '../features/voice';
import { useApiConfig } from '../services/api';
import { brl, hhmm } from '../utils/format';
import { distanceKm } from '../utils/geo';
import { hapticTap } from '../utils/haptics';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'MD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

/** Tela principal: mapa, status, contador de espera e a conversa com o agente. */
export function TripPage() {
  const { t } = useTranslation();
  const nav = useNavigation<BottomTabNavigationProp<MainTabParams>>();
  const {
    phase,
    position,
    activeRoute,
    simMinutes,
    arrivedAtMin,
    unloadedAtMin,
    backendStay,
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
  const preferredMode = useVoice((s) => s.preferredMode);
  const agoraStage = useVoice((s) => s.agoraStage);
  const audioRoute = useVoice((s) => s.audioRoute);
  const lastError = useVoice((s) => s.lastError);
  const clearError = useVoice((s) => s.clearError);
  const apiMode = useApiConfig((s) => s.mode);
  const session = useSession((s) => s.session);
  const [demoOpen, setDemoOpen] = useState(false);
  const [cabinModeOpen, setCabinModeOpen] = useState(false);

  const driverName = session?.name || activeRoute.driverName || t('auth.demoDriverName');
  const initials = getInitials(driverName);
  const leftKm = distanceKm(position, activeRoute.destination.position).toFixed(1);
  const isVoiceActive = voiceState === 'listening' || voiceState === 'speaking';

  const useBackendStay = apiMode === 'http' && backendStay !== null;
  const hasStay = useBackendStay || (arrivedAtMin !== null && (phase === 'waiting' || phase === 'unloaded'));
  const endMin = phase === 'unloaded' ? (unloadedAtMin ?? simMinutes) : simMinutes;
  const localStay = computeStay(Math.max(0, endMin - (arrivedAtMin ?? simMinutes)));
  const stayTimer = hasStay
    ? useBackendStay
      ? backendStay.tempo_parado
      : hhmm(localStay.waitedMinutes)
    : null;
  const stayOver = hasStay
    ? useBackendStay
      ? backendStay.horas_excedentes > 0 || backendStay.valor > 0
      : localStay.excessHours > 0
    : false;
  const stayValue = stayOver
    ? useBackendStay
      ? backendStay.valor_fmt
      : brl(localStay.value)
    : null;

  const canQuickArrive =
    phase === 'driving' || phase === 'approaching' || phase === 'arrived';
  const canQuickReportQueue = phase !== 'idle' && phase !== 'unloaded';
  const canQuickUnload = phase === 'waiting';

  const handleConfirmReset = () => {
    hapticTap();
    if (typeof Alert?.alert === 'function') {
      Alert.alert(
        t('trip.confirmReset.title'),
        t('trip.confirmReset.message'),
        [
          { text: t('trip.confirmReset.cancel'), style: 'cancel' },
          {
            text: t('trip.confirmReset.confirm'),
            style: 'destructive',
            onPress: () => reset(),
          },
        ],
      );
    } else {
      reset();
    }
  };

  const modePill =
    preferredMode === 'agora'
      ? agoraStage === 'live'
        ? {
            label: t('voice.modePill.agoraLive'),
            containerClass: 'bg-ok-500/15 border-ok-500/60',
            dotColor: '#17B26A',
            textClass: 'text-ok-500',
          }
        : agoraStage === 'waiting_agent' || agoraStage === 'connecting'
          ? {
              label: t('voice.modePill.agoraWaitingAgent'),
              containerClass: 'bg-wait-500/15 border-wait-500/60',
              dotColor: '#F5A524',
              textClass: 'text-wait-500',
            }
          : {
              label: t('voice.modePill.agoraDisconnected'),
              containerClass: 'bg-brand-500/15 border-brand-500/60',
              dotColor: '#099DFD',
              textClass: 'text-brand-500',
            }
      : {
          label: t('voice.modePill.mock'),
          containerClass: 'bg-ink-800 border-ink-700',
          dotColor: '#98A2B3',
          textClass: 'text-ink-300',
        };

  const showQuickConfigButton = preferredMode === 'mock' || apiMode !== 'http';
  const quickConfigLabel =
    preferredMode === 'mock' ? t('voice.useAgoraButton') : t('voice.configureBackendButton');

  return (
    <Screen hideActiveVoiceBar>
      {/* Header do Cockpit do Motorista */}
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center gap-2.5 bg-ink-900 border border-ink-700/80 rounded-full py-1.5 pl-1.5 pr-3.5">
          <View className="w-7 h-7 rounded-full bg-brand-500/20 border border-brand-500/50 items-center justify-center">
            <Text className="text-brand-500 text-xs font-bold">{initials}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text numberOfLines={1} className="text-ink-50 text-xs font-semibold">
              {driverName}
            </Text>
            <View className="w-1 h-1 rounded-full bg-ink-700" />
            <Text className="text-ink-300 text-xs font-mono font-bold">{activeRoute.plate}</Text>
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

      {/* Banner de Nova Rota Atribuída (azul #099DFD, dispensável) */}
      {routeAssignedBanner ? (
        <View className="bg-brand-500/15 border border-brand-500/60 rounded-2xl p-3 flex-row items-center justify-between gap-2.5">
          <View className="flex-row items-center gap-2.5 flex-1">
            <View className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/50 items-center justify-center">
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z"
                  stroke="#099DFD"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Circle cx={12} cy={9} r={2.5} fill="#099DFD" />
              </Svg>
            </View>
            <View className="flex-1">
              <Text className="text-brand-500 text-xs font-bold">
                {t('trip.routeAssignedBanner.title')}
              </Text>
              <Text className="text-ink-50 text-xs mt-0.5">{routeAssignedBanner}</Text>
            </View>
          </View>
          <Pressable
            onPress={clearRouteAssignedBanner}
            accessibilityRole="button"
            className="bg-brand-500/20 border border-brand-500/50 rounded-xl px-2.5 py-1.5 active:opacity-80"
          >
            <Text className="text-ink-50 text-xs font-bold">
              {t('trip.routeAssignedBanner.dismiss')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Alerta discreto de Divergência de GPS (R6 - dupla prova) */}
      {gpsDivergence ? (
        <View className="bg-alert-500/15 border border-alert-500/60 rounded-2xl p-3 flex-row items-center justify-between gap-2.5">
          <View className="flex-row items-center gap-2.5 flex-1">
            <View className="w-8 h-8 rounded-xl bg-alert-500/20 border border-alert-500/50 items-center justify-center">
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                  stroke="#F04438"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <View className="flex-1">
              <Text className="text-alert-500 text-xs font-bold">
                {t('trip.gpsDivergence.title')}
              </Text>
              <Text className="text-ink-50 text-xs mt-0.5">{gpsDivergence}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => setGpsDivergence(null)}
            accessibilityRole="button"
            className="bg-alert-500/20 border border-alert-500/50 rounded-xl px-2.5 py-1.5 active:opacity-80"
          >
            <Text className="text-ink-50 text-xs font-semibold">
              {t('trip.gpsDivergence.dismiss')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Card de Pergunta da Central (CCO) */}
      {centralRequest ? (
        <View
          className={`rounded-2xl p-3.5 border ${
            centralRequest.status === 'respondida'
              ? 'bg-ok-500/15 border-ok-500/60'
              : 'bg-wait-500/15 border-wait-500/70'
          }`}
        >
          <View className="flex-row items-start justify-between gap-2.5">
            <View className="flex-row items-start gap-2.5 flex-1">
              <View
                className={`w-8 h-8 rounded-xl border items-center justify-center mt-0.5 ${
                  centralRequest.status === 'respondida'
                    ? 'bg-ok-500/20 border-ok-500/50'
                    : 'bg-wait-500/20 border-wait-500/60'
                }`}
              >
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z"
                    stroke={centralRequest.status === 'respondida' ? '#17B26A' : '#F5A524'}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View className="flex-1">
                <Text
                  className={`text-xs font-bold ${
                    centralRequest.status === 'respondida' ? 'text-ok-500' : 'text-wait-500'
                  }`}
                >
                  {centralRequest.status === 'respondida'
                    ? t('trip.centralRequest.answeredTitle')
                    : t('trip.centralRequest.title')}
                </Text>
                {centralRequest.pergunta ? (
                  <Text className="text-ink-50 text-sm font-semibold mt-1">
                    “{centralRequest.pergunta}”
                  </Text>
                ) : null}
                {centralRequest.status === 'respondida' && centralRequest.resposta ? (
                  <Text className="text-ink-300 text-xs mt-1">{centralRequest.resposta}</Text>
                ) : (
                  <Text className="text-wait-500 text-xs font-medium mt-1">
                    {t('trip.centralRequest.voiceHint')}
                  </Text>
                )}
              </View>
            </View>
            <Pressable
              onPress={() => setCentralRequest(null)}
              accessibilityRole="button"
              className="bg-ink-900/70 border border-ink-700 rounded-lg px-2 py-1 active:opacity-80"
            >
              <Text className="text-ink-300 text-[11px] font-semibold">
                {t('trip.centralRequest.dismiss')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Card compacto de resumo da rota + atalho p/ aba Mapa */}
      <Card className="p-3.5">
        <View className="flex-row items-center justify-between gap-2">
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
            <Text
              style={{ fontVariant: ['tabular-nums'] }}
              className="text-ink-300 text-xs mt-1"
            >
              {t('trip.left', { km: leftKm })} · {t('trip.receiver')}{' '}
              {activeRoute.destination.receiverName ?? activeRoute.destination.name}
            </Text>
          </View>

          <Pressable
            onPress={() => nav.navigate('Map')}
            accessibilityRole="button"
            className="bg-brand-500/15 border border-brand-500/50 active:opacity-80 rounded-xl px-3 py-2"
          >
            <Text className="text-brand-500 text-xs font-bold">{t('trip.viewMapShortcut')}</Text>
          </Pressable>
        </View>

        {phase === 'idle' ? (
          <View className="mt-3 pt-2.5 border-t border-ink-700/70">
            <Button
              label={t('trip.start')}
              onPress={start}
              icon={
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
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
          </View>
        ) : null}
      </Card>

      {phase !== 'idle' && (
        <>
          <TripStatusCard />
          <StayCounter />
        </>
      )}

      {/* Cockpit de Voz (sempre visível, inclusive em phase === 'idle') */}
      <Card className={isVoiceActive ? 'border-brand-500/70' : ''}>
        <View className="flex-row justify-between items-center mb-1.5">
          <View className="flex-row items-center gap-2">
            <View className="w-7 h-7 rounded-lg bg-brand-500/15 border border-brand-500/40 items-center justify-center">
              <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"
                  stroke="#099DFD"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
            </View>
            <Text className="text-ink-50 text-base font-bold">{t('voice.title')}</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Pressable
              onPress={() => {
                hapticTap();
                setCabinModeOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('voice.cabinMode.openButton')}
              className="flex-row items-center gap-1 bg-ink-800 border border-brand-500/50 active:opacity-80 rounded-full px-2.5 py-1"
            >
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
                  stroke="#099DFD"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text className="text-brand-500 text-[11px] font-bold">
                {t('voice.cabinMode.openButton')}
              </Text>
            </Pressable>
            <VoiceStateIndicator />
          </View>
        </View>

        {/* Pílula clara de modo Agora / Simulada + rota de áudio + botão compacto p/ abrir Demo */}
        <View className="flex-row flex-wrap items-center justify-between gap-2 mb-2">
          <View className="flex-row items-center gap-1.5">
            <View
              className={`flex-row items-center gap-1.5 border rounded-full px-2.5 py-1 ${modePill.containerClass}`}
            >
              <View
                style={{ backgroundColor: modePill.dotColor }}
                className="w-2 h-2 rounded-full"
              />
              <Text className={`text-xs font-semibold ${modePill.textClass}`}>
                {modePill.label}
              </Text>
            </View>

            <View className="flex-row items-center gap-1 bg-ink-800 border border-ink-700 rounded-full px-2 py-1">
              <Text className="text-ink-300 text-[10px] font-semibold">
                {t(`voice.audioRoute.${audioRoute}`)}
              </Text>
            </View>
          </View>

          {showQuickConfigButton && (
            <Pressable
              onPress={() => setDemoOpen(true)}
              accessibilityRole="button"
              className="bg-brand-500/15 border border-brand-500/60 active:opacity-80 rounded-full px-3 py-1"
            >
              <Text className="text-brand-50 text-xs font-semibold">
                {quickConfigLabel}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Caixa discreta vermelha em caso de erro real (lastError) */}
        {lastError ? (
          <View className="bg-alert-500/15 border border-alert-500/60 rounded-xl p-2.5 mb-2.5 flex-row items-center justify-between gap-2">
            <Text className="text-alert-500 text-xs font-medium flex-1">
              {lastError}
            </Text>
            <Pressable
              onPress={clearError}
              accessibilityRole="button"
              className="bg-alert-500/20 border border-alert-500/50 rounded-lg px-2.5 py-1 active:opacity-80"
            >
              <Text className="text-ink-50 text-[11px] font-semibold">
                {t('demo.close')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Selo discreto de privacidade com ícone de escudo */}
        <View className="flex-row items-center gap-1.5 mb-2.5">
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"
              stroke="#17B26A"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Circle cx={12} cy={12} r={2} fill="#17B26A" />
          </Svg>
          <Text className="text-ink-300 text-xs">{t('voice.privacyBadge')}</Text>
        </View>

        <Transcript />

        <View className="items-center mt-2">
          <MicButton />
        </View>

        {/* Ações Rápidas de 1 Toque na Cabine (B2) */}
        {(canQuickArrive || canQuickReportQueue || canQuickUnload) && (
          <View className="mt-3 pt-2.5 border-t border-ink-700/70">
            <Text className="text-ink-300 text-[11px] font-semibold mb-2">
              {t('trip.quickActions.label')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {canQuickArrive && (
                <Pressable
                  onPress={() => {
                    hapticTap();
                    quickArrive();
                  }}
                  accessibilityRole="button"
                  className="flex-1 min-w-[96px] bg-brand-500/15 border border-brand-500/60 active:opacity-80 rounded-xl py-2.5 px-3 items-center justify-center"
                >
                  <Text className="text-brand-500 text-xs font-bold">
                    {t('trip.quickActions.arrived')}
                  </Text>
                </Pressable>
              )}

              {canQuickReportQueue && (
                <Pressable
                  onPress={() => {
                    hapticTap();
                    quickReportQueue();
                  }}
                  accessibilityRole="button"
                  className="flex-1 min-w-[116px] bg-wait-500/15 border border-wait-500/60 active:opacity-80 rounded-xl py-2.5 px-3 items-center justify-center"
                >
                  <Text className="text-wait-500 text-xs font-bold">
                    {t('trip.quickActions.reportQueue')}
                  </Text>
                </Pressable>
              )}

              {canQuickUnload && (
                <Pressable
                  onPress={() => {
                    hapticTap();
                    quickUnload();
                  }}
                  accessibilityRole="button"
                  className="flex-1 min-w-[96px] bg-ok-500/15 border border-ok-500/60 active:opacity-80 rounded-xl py-2.5 px-3 items-center justify-center"
                >
                  <Text className="text-ok-500 text-xs font-bold">
                    {t('trip.quickActions.unloaded')}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        <QuickUtterances />
      </Card>

      {/* Timeline ao vivo da Jornada ("Prova da Espera" — A5) */}
      <JourneyTimeline />

      {phase === 'unloaded' && (
        <Button label={t('trip.restart')} variant="ghost" onPress={handleConfirmReset} />
      )}

      {/* Modal Full-Screen Modo Cabine / Mãos-Livres (B1) */}
      <CabinModeModal
        visible={cabinModeOpen}
        onClose={() => setCabinModeOpen(false)}
        stayTimer={stayTimer}
        stayValue={stayValue}
        stayOver={stayOver}
      />

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
