import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import { Badge } from '../../../components/Badge';
import { Card } from '../../../components/Card';
import { BUSINESS } from '../../../lib/config';
import { useApiConfig } from '../../../services/api';
import { brl, hhmm } from '../../../utils/format';
import { useTrip } from '../hooks/useTrip';
import { computeStay } from '../rules/stay';
import { colors } from '../../../lib/theme';

const CHANNEL_LABEL_KEYS = [
  'stay.channels.push',
  'stay.channels.painel',
  'stay.channels.ligacao',
] as const;

/**
 * Contador de espera: começa no check-in de chegada, mostra franquia restante e estadia acumulada.
 * Em modo `http`, prioriza o objeto `Estadia` ao vivo (`backendStay`) recebido via WebSocket (`/ws`).
 * Em modo `mock`, calcula localmente e congela o valor final em `unloadedAtMin` quando `phase === 'unloaded'`.
 */
export function StayCounter() {
  const { t } = useTranslation();
  const apiMode = useApiConfig((s) => s.mode);
  const {
    phase,
    simMinutes,
    arrivedAtMin,
    unloadedAtMin,
    ccoAttempts,
    ccoAcknowledged,
    backendStay,
  } = useTrip();

  const useBackend = apiMode === 'http' && backendStay !== null;

  if (!useBackend && (arrivedAtMin === null || (phase !== 'waiting' && phase !== 'unloaded'))) {
    return null;
  }

  const endMin = phase === 'unloaded' ? (unloadedAtMin ?? simMinutes) : simMinutes;
  const stay = computeStay(Math.max(0, endMin - (arrivedAtMin ?? simMinutes)));

  const over = useBackend
    ? backendStay.horas_excedentes > 0 || backendStay.valor > 0
    : stay.excessHours > 0;
  const isUnloaded = phase === 'unloaded' || (useBackend && backendStay.encerrada);
  const franchiseHours = useBackend
    ? backendStay.franquia_h || BUSINESS.franchiseHours
    : BUSINESS.franchiseHours;
  const franchiseTotalMin = franchiseHours * 60;
  const progressPct = useBackend
    ? Math.min(100, Math.round((backendStay.horas_paradas / (franchiseHours || 1)) * 100))
    : Math.min(100, Math.round((stay.waitedMinutes / (franchiseTotalMin || 1)) * 100));

  const timerText = useBackend ? backendStay.tempo_parado : hhmm(stay.waitedMinutes);
  const franchiseLeftText = useBackend
    ? backendStay.franquia_restante
    : hhmm(stay.franchiseLeftMinutes);
  const valueText = useBackend ? backendStay.valor_fmt : brl(stay.value);

  return (
    <Card className={over ? 'border-wait-500/70' : ''}>
      {/* Topo do card de telemetria */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View
            className={`w-7 h-7 rounded-lg items-center justify-center ${
              over ? 'bg-wait-500/20' : 'bg-brand-500/15'
            }`}
          >
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <Circle
                cx={12}
                cy={13}
                r={8}
                stroke={over ? colors.wait[500] : colors.brand[300]}
                strokeWidth={2}
              />
              <Path
                d="M12 9v4l2.5 2.5M9 2h6"
                stroke={over ? colors.wait[500] : colors.brand[300]}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
          </View>
          <Text className="text-ink-300 text-xs font-semibold uppercase tracking-wider">
            {t('stay.waiting')}
          </Text>
        </View>
        {isUnloaded ? (
          <Badge tone="ok" label={t('stay.unloadedBadge')} />
        ) : over ? (
          <Badge tone="wait" label={t('stay.franchiseExceeded')} />
        ) : null}
      </View>

      {/* Cronômetro principal */}
      <Text
        style={{ fontVariant: ['tabular-nums'] }}
        className={`text-5xl font-bold tracking-tight mt-2 ${
          over ? 'text-wait-500' : 'text-ink-50'
        }`}
      >
        {timerText}
      </Text>

      {/* Barra de progresso da franquia de 5 h */}
      <View className="mt-3">
        <View className="flex-row items-center justify-between mb-1.5">
          <Text className="text-ink-300 text-xs">
            {t('stay.franchiseBarLabel', { hours: franchiseHours })}
          </Text>
          <Text className="text-ink-300 text-xs font-semibold">
            {t('stay.franchiseLeft', { left: franchiseLeftText })}
          </Text>
        </View>
        <View className="h-2.5 bg-ink-800 rounded-full overflow-hidden border border-ink-700/70">
          <View
            style={{ width: `${progressPct}%` }}
            className={`h-full rounded-full ${over ? 'bg-wait-500' : 'bg-brand-500'}`}
          />
        </View>
      </View>

      {/* Caixa destacada âmbar quando há estadia excedente */}
      {over && (
        <View className="mt-3 bg-wait-500/15 border border-wait-500/60 rounded-xl px-3.5 py-2.5 flex-row items-center justify-between">
          <Text className="text-wait-500 text-sm font-bold">
            {t('stay.value', { value: valueText })}
          </Text>
        </View>
      )}

      {/* Stepper de escalonamento ao CCO com os 3 canais rotulados */}
      <View className="mt-4 pt-3 border-t border-ink-700/70">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-ink-300 text-xs font-medium">
            {ccoAcknowledged
              ? t('stay.ccoAck')
              : t('stay.ccoAttempts', { n: ccoAttempts, max: BUSINESS.maxCcoAttempts })}
          </Text>
        </View>
        <View className="flex-row gap-2">
          {Array.from({ length: BUSINESS.maxCcoAttempts }).map((_, i) => {
            const active = i < ccoAttempts;
            const barColor = active
              ? ccoAcknowledged
                ? 'bg-ok-500'
                : 'bg-alert-500'
              : 'bg-ink-700';
            const textColor = active
              ? ccoAcknowledged
                ? 'text-ok-500'
                : 'text-alert-500'
              : 'text-ink-300';
            const labelKey = CHANNEL_LABEL_KEYS[i] ?? 'stay.channels.ligacao';

            return (
              <View key={i} className="flex-1">
                <View className={`h-2 rounded-full ${barColor}`} />
                <Text className={`text-[11px] font-semibold mt-1 text-center ${textColor}`}>
                  {t(labelKey)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </Card>
  );
}
