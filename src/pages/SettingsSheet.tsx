import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { useSession } from '../features/auth';
import { DemoControls, useTrip } from '../features/trip';
import { useVoice } from '../features/voice';
import { downloadOfflineWhisperModel, useOfflineWhisperModel } from '../features/voice/api/offlineWhisperModel';
import { colors } from '../lib/theme';
import { useNetwork } from '../services/network';
import { useWakeWord } from '../services/wakeWord';
import { hapticTap } from '../utils/haptics';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

/**
 * Ajustes do motorista: perfil, idioma, modo de voz e sair. O painel Demo (simulação,
 * regra E8) fica aqui, com a borda tracejada que marca o que é simulado.
 */
export function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const session = useSession((s) => s.session);
  const logout = useSession((s) => s.logout);
  const plate = useTrip((s) => s.activeRoute.plate);
  const preferredMode = useVoice((s) => s.preferredMode);
  const modelStatus = useOfflineWhisperModel((s) => s.status);
  const modelProgress = useOfflineWhisperModel((s) => s.progress);
  const networkAvailable = useNetwork((s) => s.quality() !== 'offline');
  const agoraStage = useVoice((s) => s.agoraStage);
  const audioRoute = useVoice((s) => s.audioRoute);
  const wakeEnabled = useWakeWord((s) => s.enabled);
  const wakeStatus = useWakeWord((s) => s.status);
  const setWakeEnabled = useWakeWord((s) => s.setEnabled);
  const [demoOpen, setDemoOpen] = useState(false);

  const driverName = session?.name || t('auth.demoDriverName');
  const companyName = session?.company || t('auth.demoCompanyName');

  const modeLabel =
    preferredMode === 'agora'
      ? agoraStage === 'live'
        ? t('voice.modePill.agoraLive')
        : agoraStage === 'waiting_agent' || agoraStage === 'connecting'
          ? t('voice.modePill.agoraWaitingAgent')
          : t('voice.modePill.agoraDisconnected')
      : t('voice.modePill.mock');

  const close = () => {
    setDemoOpen(false);
    onClose();
  };

  const confirmLogout = () => {
    hapticTap();
    Alert.alert(t('auth.confirmLogout.title'), t('auth.confirmLogout.message'), [
      { text: t('auth.confirmLogout.cancel'), style: 'cancel' },
      {
        text: t('auth.confirmLogout.confirm'),
        style: 'destructive',
        onPress: () => {
          close();
          logout();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View className="flex-1 justify-end bg-ink-950/80">
        <Pressable className="flex-1" onPress={close} accessibilityLabel={t('demo.close')} />
        <View className="bg-ink-950 border-t border-ink-800 rounded-t-[32px] px-4 pt-3 pb-8 max-h-[88%]">
          <View className="w-10 h-1 rounded-full bg-ink-700 self-center mb-3" />
          {demoOpen ? (
            <DemoControls onClose={() => setDemoOpen(false)} />
          ) : (
            <ScrollView contentContainerStyle={{ gap: 16 }}>
              <View className="flex-row items-center justify-between">
                <Text accessibilityRole="header" className="text-ink-50 text-2xl font-display">
                  {t('settings.title')}
                </Text>
                <Pressable
                  onPress={close}
                  accessibilityRole="button"
                  accessibilityLabel={t('demo.close')}
                  className="w-11 h-11 rounded-full bg-ink-800 items-center justify-center active:opacity-80"
                >
                  <Icon name="x" size={20} />
                </Pressable>
              </View>

              <View className="bg-ink-900 border border-ink-800 rounded-3xl p-4 flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-full bg-brand-500/20 items-center justify-center">
                  <Text className="text-brand-300 text-base font-bold">{initialsOf(driverName)}</Text>
                </View>
                <View className="flex-1">
                  <Text numberOfLines={1} className="text-ink-50 text-lg font-bold">
                    {driverName}
                  </Text>
                  <Text numberOfLines={1} className="text-ink-300 text-sm">
                    {companyName} · <Text className="text-brand-300 font-mono font-bold">{plate}</Text>
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="text-ink-50 text-base font-semibold">{t('lang.label')}</Text>
                <LanguageSwitch />
              </View>

              <View className="bg-ink-900 border border-ink-800 rounded-3xl p-4 gap-1.5">
                <Text className="text-ink-300 text-xs font-bold uppercase tracking-widest">
                  {t('settings.voice')}
                </Text>
                <Text className="text-ink-50 text-base font-semibold">
                  {modeLabel} · {t(`voice.audioRoute.${audioRoute}`)}
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <Icon name="check" size={14} color={colors.ok[500]} />
                  <Text className="text-ink-300 text-sm">{t('voice.privacyBadge')}</Text>
                </View>
              </View>

              {preferredMode === 'agora' ? (
                <View className="bg-ink-900 border border-ink-800 rounded-3xl p-4 gap-2">
                  <Text className="text-ink-50 text-base font-semibold">
                    {t('voice.offlineModel.title')}
                  </Text>
                  <Text className="text-ink-300 text-sm leading-5">
                    {t(`voice.offlineModel.${modelStatus}`, { progress: modelProgress })}
                  </Text>
                  {modelStatus === 'downloading' ? (
                    <View className="h-1.5 bg-ink-700 rounded-full overflow-hidden">
                      <View
                        className="h-full bg-brand-400"
                        style={{ width: `${modelProgress}%` }}
                      />
                    </View>
                  ) : null}
                  {modelStatus === 'error' ? (
                    <Pressable
                      onPress={() => void downloadOfflineWhisperModel().catch(() => undefined)}
                      disabled={!networkAvailable}
                      accessibilityRole="button"
                      className="self-start rounded-full bg-ink-800 px-4 py-2 active:opacity-80 disabled:opacity-50"
                    >
                      <Text className="text-brand-300 text-sm font-bold">
                        {t('voice.offlineModel.retry')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <View className="bg-ink-900 border border-ink-800 rounded-3xl p-4 gap-2">
                <View className="flex-row items-center gap-3">
                  <Icon name="mic" size={20} color={colors.brand[300]} />
                  <Text className="flex-1 text-ink-50 text-base font-semibold">{t('voice.wake.title')}</Text>
                  <Switch
                    value={wakeEnabled}
                    onValueChange={(on) => {
                      hapticTap();
                      setWakeEnabled(on);
                    }}
                    disabled={wakeStatus === 'unavailable'}
                    accessibilityLabel={t('voice.wake.title')}
                    accessibilityHint={t('voice.wake.hint')}
                    trackColor={{ false: colors.ink[700], true: colors.brand[500] }}
                    thumbColor={wakeEnabled ? colors.brand[300] : colors.ink[300]}
                  />
                </View>
                <Text className="text-ink-300 text-sm leading-5">{t('voice.wake.hint')}</Text>
                {wakeStatus === 'unavailable' || wakeStatus === 'denied' ? (
                  <View className="flex-row items-center gap-1.5">
                    <Icon name="alert" size={14} color={colors.wait[500]} />
                    <Text className="flex-1 text-wait-500 text-sm">
                      {t(wakeStatus === 'denied' ? 'voice.wake.permissionDenied' : 'voice.wake.unavailable')}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Pressable
                onPress={() => {
                  hapticTap();
                  setDemoOpen(true);
                }}
                accessibilityRole="button"
                className="border border-dashed border-ink-700 rounded-3xl p-4 flex-row items-center gap-3 active:opacity-80"
              >
                <Icon name="sliders" size={20} color={colors.wait[500]} />
                <View className="flex-1">
                  <Text className="text-ink-50 text-base font-bold">{t('trip.demoButton')}</Text>
                  <Text className="text-ink-300 text-sm">{t('settings.demoHint')}</Text>
                </View>
                <Icon name="chevronRight" size={20} color={colors.ink[300]} />
              </Pressable>

              <Button
                variant="outline"
                label={t('auth.logout')}
                onPress={confirmLogout}
                icon={<Icon name="logout" size={18} color={colors.ink[300]} />}
              />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
