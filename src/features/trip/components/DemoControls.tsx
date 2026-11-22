import { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ApiMode, VoiceMode } from '../../../lib/config';
import { useApiConfig } from '../../../services/api';
import type { HealthCheckResult } from '../../../services/apiClient';
import { useBackendStream } from '../../../services/backendStream';
import { useDeviceGps } from '../../../services/deviceGps';
import { httpApiClient } from '../../../services/httpApi';
import { useNetwork, type NetworkQuality } from '../../../services/network';
import { hapticTap } from '../../../utils/haptics';
import { useDocuments } from '../../documents';
import { useVoice } from '../../voice';
import { useTrip } from '../hooks/useTrip';
import { useMapMode, type MapMode } from './RouteMap';

/**
 * Controles da demo (borda tracejada — E8):
 * - Rede: Real / Fraca / Sem rede
 * - Switch: CCO responde na 2ª tentativa
 * - Atalhos de tempo/rota: +1 h, Ir p/ Aproximação (8 km), Ir p/ Chegada
 * - Toggles de modo: API (Mock | Backend), Voz (Mock | Agora) e Mapa (Auto | SVG)
 * - URL do Backend em tempo real (trycloudflare.com) + Testar (/health) + status do WebSocket + Resetar rota
 */
export function DemoControls({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();
  const { override, setOverride } = useNetwork();
  const { phase, ccoWillRespond, setCcoWillRespond, skip, jumpToApproach, jumpToArrival, reset } =
    useTrip();
  const preferredVoiceMode = useVoice((s) => s.preferredMode);
  const voiceFallbackReason = useVoice((s) => s.fallbackReason);
  const voiceLastError = useVoice((s) => s.lastError);
  const sessionConnected = useVoice((s) => s.sessionConnected);
  const setVoiceMode = useVoice((s) => s.setVoiceMode);
  const connectAgoraNow = useVoice((s) => s.connectAgoraNow);
  const { mapMode, setMapMode, fallbackReason: getMapFallbackReason } = useMapMode();

  const apiMode = useApiConfig((s) => s.mode);
  const baseUrl = useApiConfig((s) => s.baseUrl);
  const rotaId = useApiConfig((s) => s.rotaId);
  const recentUrls = useApiConfig((s) => s.recentUrls);
  const setApiMode = useApiConfig((s) => s.setMode);
  const setBaseUrl = useApiConfig((s) => s.setBaseUrl);
  const addRecentUrl = useApiConfig((s) => s.addRecentUrl);
  const wsStatus = useBackendStream((s) => s.status);
  const deviceGpsEnabled = useDeviceGps((s) => s.enabled);
  const setDeviceGpsEnabled = useDeviceGps((s) => s.setEnabled);

  const [urlInput, setUrlInput] = useState(baseUrl);
  const [testingHealth, setTestingHealth] = useState(false);
  const [connectingAll, setConnectingAll] = useState(false);
  const [comboReady, setComboReady] = useState(false);
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [resettingBackend, setResettingBackend] = useState(false);

  const netOptions: (NetworkQuality | null)[] = [null, 'weak', 'offline'];
  const apiModes: { mode: ApiMode; label: string }[] = [
    { mode: 'mock', label: t('demo.apiMock') },
    { mode: 'http', label: t('demo.apiHttp') },
  ];
  const voiceModes: { mode: VoiceMode; label: string }[] = [
    { mode: 'mock', label: t('demo.voiceMock') },
    { mode: 'agora', label: t('demo.voiceAgora') },
  ];
  const mapModes: { mode: MapMode; label: string }[] = [
    { mode: 'auto', label: t('demo.mapAuto') },
    { mode: 'svg', label: t('demo.mapSvg') },
  ];

  const mapFallback = getMapFallbackReason();

  const handleUrlChange = (value: string) => {
    setUrlInput(value);
    setBaseUrl(value);
  };

  const handleTestHealth = async () => {
    setBaseUrl(urlInput);
    addRecentUrl(urlInput);
    setTestingHealth(true);
    try {
      const res = await httpApiClient.checkHealth();
      setHealthResult(res);
      if (!res.ok) setComboReady(false);
    } finally {
      setTestingHealth(false);
    }
  };

  const handleConnectBackendAndAgora = async () => {
    setBaseUrl(urlInput);
    addRecentUrl(urlInput);
    setConnectingAll(true);
    setComboReady(false);
    try {
      const res = await httpApiClient.checkHealth();
      setHealthResult(res);
      if (res.ok) {
        setApiMode('http');
        void useTrip.getState().syncRouteFromBackend();
        void useDocuments.getState().syncFromBackend();
        await connectAgoraNow();
        const voiceState = useVoice.getState();
        if (voiceState.sessionConnected && !voiceState.lastError) {
          setComboReady(true);
          onClose?.();
        }
      }
    } finally {
      setConnectingAll(false);
    }
  };

  const handleResetBackendRoute = async () => {
    setResettingBackend(true);
    try {
      await httpApiClient.resetRoute(rotaId).catch(() => undefined);
      reset();
    } finally {
      setResettingBackend(false);
    }
  };

  const wsBadgeTone =
    wsStatus === 'connected'
      ? 'bg-ok-500/20 border-ok-500/60 text-ok-500'
      : wsStatus === 'connecting'
        ? 'bg-wait-500/20 border-wait-500/60 text-wait-500'
        : 'bg-ink-800 border-ink-700 text-ink-300';

  const isComboReadyVisible =
    comboReady &&
    healthResult?.ok &&
    apiMode === 'http' &&
    preferredVoiceMode === 'agora' &&
    sessionConnected &&
    !voiceLastError;

  return (
    <View className="bg-ink-900 border border-dashed border-ink-700 rounded-2xl p-4">
      {/* Cabeçalho do painel de simulação E8 */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2 flex-1 pr-2">
          <View className="bg-wait-500/15 border border-dashed border-wait-500/70 rounded-md px-2 py-0.5">
            <Text className="text-wait-500 text-[10px] font-bold">{t('demo.simBadge')}</Text>
          </View>
          <Text numberOfLines={1} className="text-ink-50 text-sm font-bold flex-1">
            {t('demo.title')}
          </Text>
        </View>
        {onClose ? (
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            className="bg-ink-800 border border-ink-700 rounded-full px-3 py-1 active:opacity-80"
          >
            <Text className="text-ink-50 text-xs font-semibold">{t('demo.close')}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* 1. TOPO: Conexão Backend & Voz Agora */}
      <View className="bg-ink-950/70 border border-brand-500/40 rounded-xl p-3 mb-3">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-ink-50 text-xs font-bold">
            {t('demo.backendAndAgoraSection')}
          </Text>
          <View className="flex-row items-center gap-1.5">
            {healthResult && (
              <View
                className={`px-2 py-0.5 rounded-full border ${
                  healthResult.ok
                    ? 'bg-ok-500/20 border-ok-500/60'
                    : 'bg-alert-500/20 border-alert-500/60'
                }`}
              >
                <Text
                  className={`text-[10px] font-bold ${
                    healthResult.ok ? 'text-ok-500' : 'text-alert-500'
                  }`}
                >
                  {healthResult.ok
                    ? t('demo.healthOnline')
                    : t('demo.healthError', { error: healthResult.error ?? 'HTTP' })}
                </Text>
              </View>
            )}
            <View className={`px-2 py-0.5 rounded-full border ${wsBadgeTone}`}>
              <Text
                className={`text-[10px] font-bold ${
                  wsStatus === 'connected'
                    ? 'text-ok-500'
                    : wsStatus === 'connecting'
                      ? 'text-wait-500'
                      : 'text-ink-300'
                }`}
              >
                {t(`demo.wsStatus.${wsStatus}`)}
              </Text>
            </View>
          </View>
        </View>

        <Text className="text-ink-300 text-[11px] font-semibold mb-1">
          {t('demo.backendUrlLabel')}
        </Text>
        <View className="flex-row items-center gap-2 mb-2">
          <TextInput
            value={urlInput}
            onChangeText={handleUrlChange}
            placeholder={t('demo.backendUrlPlaceholder')}
            placeholderTextColor="#667085"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            className="flex-1 bg-ink-800 border border-ink-700 rounded-xl px-3 py-2 text-ink-50 text-xs font-mono"
          />
          <Pressable
            onPress={() => void handleTestHealth()}
            disabled={testingHealth || connectingAll}
            className="bg-ink-800 border border-ink-700 rounded-xl px-3 py-2 active:opacity-80"
          >
            <Text className="text-ink-50 text-xs font-semibold">
              {testingHealth ? t('demo.testingHealth') : t('demo.testHealthButton')}
            </Text>
          </Pressable>
        </View>

        {/* Chips de presets rápidos de URL (A4) */}
        {recentUrls.length > 0 && (
          <View className="flex-row flex-wrap items-center gap-1.5 mb-2.5">
            <Text className="text-ink-300 text-[10px] font-semibold mr-0.5">
              {t('demo.urlPresetsLabel')}
            </Text>
            {recentUrls.map((preset) => {
              const isSelected = urlInput.trim().replace(/\/+$/, '') === preset;
              return (
                <Pressable
                  key={preset}
                  onPress={() => {
                    hapticTap();
                    handleUrlChange(preset);
                  }}
                  accessibilityRole="button"
                  className={`px-2.5 py-1 rounded-full border active:opacity-80 ${
                    isSelected
                      ? 'bg-brand-500/25 border-brand-500'
                      : 'bg-ink-800 border-ink-700'
                  }`}
                >
                  <Text
                    numberOfLines={1}
                    className={`text-[10px] font-mono max-w-[180px] ${
                      isSelected ? 'text-brand-500 font-bold' : 'text-ink-300'
                    }`}
                  >
                    {preset.replace(/^https?:\/\//, '')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          onPress={() => void handleConnectBackendAndAgora()}
          disabled={connectingAll}
          accessibilityRole="button"
          className="bg-brand-500 border border-brand-500 rounded-xl py-2.5 px-3.5 items-center justify-center active:opacity-85 mb-2.5"
        >
          <Text className="text-ink-50 text-xs font-bold">
            {connectingAll ? t('demo.connectingBackendAndAgora') : t('demo.connectBackendAndAgora')}
          </Text>
        </Pressable>

        {healthResult?.ok && healthResult.llmMode && (
          <View className="bg-ink-900 border border-ink-700 rounded-lg px-2.5 py-1.5 mb-2.5 flex-row items-center justify-between">
            <Text className="text-ink-300 text-[11px] font-mono">
              {t('demo.backendPipelineStatus', {
                mode: healthResult.llmMode,
                upstream:
                  healthResult.llmUpstream === false
                    ? t('demo.llmContingency')
                    : t('demo.llmUpstreamOk'),
              })}
            </Text>
            {healthResult.receiverMode ? (
              <Text className="text-brand-500 text-[10px] font-bold uppercase">
                {healthResult.receiverMode}
              </Text>
            ) : null}
          </View>
        )}

        {healthResult?.ok && healthResult.agoraConfigured === false && (
          <View className="bg-wait-500/15 border border-wait-500/60 rounded-lg px-2.5 py-2 mb-2.5">
            <Text className="text-wait-500 text-xs font-semibold">
              {t('demo.agoraNotConfiguredWarning')}
            </Text>
          </View>
        )}

        {voiceLastError && (
          <View className="bg-alert-500/15 border border-alert-500/60 rounded-lg px-2.5 py-2 mb-2.5">
            <Text className="text-alert-500 text-xs font-bold">{voiceLastError}</Text>
          </View>
        )}

        {isComboReadyVisible && (
          <View className="bg-ok-500/15 border border-ok-500/60 rounded-lg px-2.5 py-1.5 mb-2.5 flex-row items-center gap-1.5">
            <View className="w-2 h-2 rounded-full bg-ok-500" />
            <Text className="text-ok-500 text-xs font-bold">
              {t('demo.comboReadyStatus')}
            </Text>
          </View>
        )}

        {/* Toggles manuais Mock | Backend, Mock | Agora e Auto | SVG */}
        <View className="flex-row flex-wrap items-center justify-between gap-2 pt-2 border-t border-ink-800">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-ink-300 text-xs mr-1">{t('demo.apiModeLabel')}</Text>
            {apiModes.map(({ mode, label }) => {
              const active = apiMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => {
                    setApiMode(mode);
                    if (mode === 'http') {
                      void useTrip.getState().syncRouteFromBackend();
                    }
                  }}
                  className={`px-3 py-1 rounded-full border ${
                    active ? 'bg-brand-500 border-brand-500' : 'bg-ink-800 border-ink-700'
                  }`}
                >
                  <Text className="text-ink-50 text-xs font-semibold">{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View className="flex-row items-center gap-1.5">
            <Text className="text-ink-300 text-xs mr-1">{t('demo.voiceModeLabel')}</Text>
            {voiceModes.map(({ mode, label }) => {
              const active = preferredVoiceMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => void setVoiceMode(mode)}
                  className={`px-3 py-1 rounded-full border ${
                    active ? 'bg-brand-500 border-brand-500' : 'bg-ink-800 border-ink-700'
                  }`}
                >
                  <Text className="text-ink-50 text-xs font-semibold">{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View className="flex-row items-center gap-1.5">
            <Text className="text-ink-300 text-xs mr-1">{t('demo.mapModeLabel')}</Text>
            {mapModes.map(({ mode, label }) => {
              const active = mapMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setMapMode(mode)}
                  className={`px-3 py-1 rounded-full border ${
                    active ? 'bg-brand-500 border-brand-500' : 'bg-ink-800 border-ink-700'
                  }`}
                >
                  <Text className="text-ink-50 text-xs font-semibold">{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {preferredVoiceMode === 'agora' && voiceFallbackReason && (
          <View className="bg-wait-500/15 border border-wait-500/40 rounded-lg px-2.5 py-1.5 mt-2">
            <Text className="text-wait-500 text-xs">
              {t(`demo.fallback.${voiceFallbackReason}`, voiceFallbackReason)}
            </Text>
          </View>
        )}

        {mapMode === 'auto' && mapFallback && (
          <View className="bg-wait-500/15 border border-wait-500/40 rounded-lg px-2.5 py-1.5 mt-2">
            <Text className="text-wait-500 text-xs">
              {t(`demo.fallback.${mapFallback}`, mapFallback)}
            </Text>
          </View>
        )}
      </View>

      {/* Condição de Rede */}
      <Text className="text-ink-300 text-xs font-semibold mb-1.5">{t('demo.networkSection')}</Text>
      <View className="flex-row flex-wrap gap-2 mb-3">
        {netOptions.map((o) => {
          const active = override === o;
          return (
            <Pressable
              key={String(o)}
              onPress={() => setOverride(o)}
              className={`px-3.5 py-1.5 rounded-full border ${
                active ? 'bg-brand-500 border-brand-500' : 'bg-ink-800 border-ink-700'
              }`}
            >
              <Text className={`text-xs font-semibold ${active ? 'text-ink-50' : 'text-ink-300'}`}>
                {t(`demo.net.${o ?? 'real'}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Resposta do CCO */}
      <View className="flex-row items-center justify-between bg-ink-800/80 border border-ink-700/70 rounded-xl px-3.5 py-2.5 mb-2">
        <Text className="text-ink-50 text-xs font-medium flex-1 pr-2">{t('demo.ccoResponds')}</Text>
        <Switch
          value={ccoWillRespond}
          onValueChange={setCcoWillRespond}
          trackColor={{ false: '#2A3550', true: '#099DFD' }}
          thumbColor="#F4F6FA"
        />
      </View>

      {/* GPS Real do Celular (C2 seguro sem rebuild) */}
      <View className="flex-row items-center justify-between bg-ink-800/80 border border-ink-700/70 rounded-xl px-3.5 py-2.5 mb-3">
        <View className="flex-1 pr-2">
          <Text className="text-ink-50 text-xs font-medium">{t('demo.deviceGpsToggle')}</Text>
          <Text className="text-ink-300 text-[10px]">{t('demo.deviceGpsHint')}</Text>
        </View>
        <Switch
          value={deviceGpsEnabled}
          onValueChange={setDeviceGpsEnabled}
          trackColor={{ false: '#2A3550', true: '#17B26A' }}
          thumbColor="#F4F6FA"
        />
      </View>

      {/* Avanço rápido de rota e tempo */}
      <Text className="text-ink-300 text-xs font-semibold mb-1.5">
        {t('demo.timeAndRouteSection')}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Pressable
          onPress={() => skip(60)}
          className="px-3.5 py-1.5 rounded-full border border-ink-700 bg-ink-800 active:opacity-80"
        >
          <Text className="text-ink-50 text-xs font-semibold">{t('demo.skipHour')}</Text>
        </Pressable>

        {phase === 'driving' && (
          <Pressable
            onPress={jumpToApproach}
            className="px-3.5 py-1.5 rounded-full border border-brand-500 bg-brand-500/20 active:opacity-80"
          >
            <Text className="text-ink-50 text-xs font-semibold">{t('demo.jumpApproach')}</Text>
          </Pressable>
        )}

        {(phase === 'driving' || phase === 'approaching') && (
          <Pressable
            onPress={jumpToArrival}
            className="px-3.5 py-1.5 rounded-full border border-brand-500 bg-brand-500/20 active:opacity-80"
          >
            <Text className="text-ink-50 text-xs font-semibold">{t('demo.jumpArrival')}</Text>
          </Pressable>
        )}

        {apiMode === 'http' && (
          <Pressable
            onPress={() => void handleResetBackendRoute()}
            disabled={resettingBackend}
            className="px-3.5 py-1.5 rounded-full border border-wait-500/70 bg-wait-500/15 active:opacity-80"
          >
            <Text className="text-wait-500 text-xs font-semibold">
              {resettingBackend ? t('demo.resettingBackendRoute') : t('demo.resetBackendRoute')}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
