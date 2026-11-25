import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import { Badge } from '../../../components/Badge';
import { Card } from '../../../components/Card';
import { hapticTap } from '../../../utils/haptics';
import { useTrip } from '../hooks/useTrip';
import type { TimelineTone } from '../types';
import { colors } from '../../../lib/theme';

const dotBg: Record<TimelineTone, string> = {
  brand: 'bg-brand-500 border-brand-50',
  ok: 'bg-ok-500 border-ink-50',
  wait: 'bg-wait-500 border-ink-50',
  alert: 'bg-alert-500 border-ink-50',
};

const labelColor: Record<TimelineTone, string> = {
  brand: 'text-ink-50',
  ok: 'text-ok-500',
  wait: 'text-wait-500',
  alert: 'text-alert-500',
};

/**
 * Timeline ao vivo da Jornada ("Prova da Espera" — A5):
 * Card dobrável exibindo todos os marcos reais e simulados com horários auditáveis.
 */
export function JourneyTimeline() {
  const { t } = useTranslation();
  const timeline = useTrip((s) => s.timeline);
  const [expanded, setExpanded] = useState(true);

  if (timeline.length === 0) return null;

  return (
    <Card>
      <Pressable
        onPress={() => {
          hapticTap();
          setExpanded((v) => !v);
        }}
        accessibilityRole="button"
        className="flex-row items-center justify-between"
      >
        <View className="flex-row items-center gap-2.5 flex-1 pr-2">
          <View className="w-7 h-7 rounded-lg bg-brand-500/15 border border-brand-500/40 items-center justify-center">
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={9} stroke={colors.brand[300]} strokeWidth={2} />
              <Path
                d="M12 7v5l3 2"
                stroke={colors.brand[300]}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
          </View>
          <Text numberOfLines={1} className="text-ink-50 text-sm font-bold flex-1">
            {t('trip.timeline.title', { count: timeline.length })}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          <Badge
            tone="brand"
            label={timeline[timeline.length - 1]?.time ?? ''}
          />
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d={expanded ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'}
              stroke={colors.ink[300]}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </Pressable>

      {expanded && (
        <View className="mt-3 pt-3 border-t border-ink-700/70">
          {timeline.map((item, idx) => {
            const isLast = idx === timeline.length - 1;
            return (
              <View key={item.id} className="flex-row items-stretch">
                {/* Coluna do horário */}
                <Text
                  style={{ fontVariant: ['tabular-nums'] }}
                  className="w-11 text-ink-300 text-xs font-mono font-semibold pt-0.5"
                >
                  {item.time}
                </Text>

                {/* Linha vertical + nó */}
                <View className="items-center mr-3">
                  <View
                    className={`w-3 h-3 rounded-full border mt-1 ${dotBg[item.tone]}`}
                  />
                  {!isLast && (
                    <View className="w-0.5 flex-1 bg-ink-700 my-1 min-h-[14px]" />
                  )}
                </View>

                {/* Descrição do evento */}
                <View className={`flex-1 ${isLast ? 'pb-0.5' : 'pb-3'}`}>
                  <Text className={`text-xs font-semibold leading-4 ${labelColor[item.tone]}`}>
                    {item.label}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}
