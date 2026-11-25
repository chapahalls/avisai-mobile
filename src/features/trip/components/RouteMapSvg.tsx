import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { distanceKm } from '../../../utils/geo';
import { useTrip } from '../hooks/useTrip';
import type { LatLng } from '../../../types/geo';
import type { TripPhase } from '../types';
import { colors } from '../../../lib/theme';

const W = 360;
const H = 240;
const PAD = 32;

const phaseDotColor: Record<TripPhase, string> = {
  idle: 'bg-ink-300',
  pickup: 'bg-brand-500',
  driving: 'bg-brand-500',
  approaching: 'bg-wait-500',
  arrived: 'bg-ok-500',
  waiting: 'bg-wait-500',
  unloaded: 'bg-ok-500',
};

/**
 * Mapa simulado desenhado em SVG (usado como fallback ou em modo SVG).
 * Protege `dx || 1` e `dy || 1` contra divisão por zero.
 */
export function RouteMapSvg({
  badgeLabel,
  fullScreen = false,
}: {
  badgeLabel?: string;
  fullScreen?: boolean;
}) {
  const { t } = useTranslation();
  const position = useTrip((s) => s.position);
  const phase = useTrip((s) => s.phase);
  const activeRoute = useTrip((s) => s.activeRoute);
  const etaMin = useTrip((s) => s.etaMin);
  const leftKm = distanceKm(position, activeRoute.destination.position);
  const computedEta =
    etaMin !== null
      ? etaMin
      : leftKm > 0.3
        ? Math.max(1, Math.round((leftKm / 80) * 60))
        : 0;
  const svgH = fullScreen ? 420 : H;

  const lats = activeRoute.path.map((p) => p.lat);
  const lngs = activeRoute.path.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const dx = maxLng - minLng || 1;
  const dy = maxLat - minLat || 1;

  const project = (p: LatLng) => ({
    x: PAD + ((p.lng - minLng) / dx) * (W - 2 * PAD),
    y: PAD + ((maxLat - p.lat) / dy) * (svgH - 2 * PAD),
  });

  const pts = activeRoute.path.map(project).map((p) => `${p.x},${p.y}`).join(' ');
  const o = project(activeRoute.origin.position);
  const d = project(activeRoute.destination.position);
  const truck = project(position);

  return (
    <View
      className={`${fullScreen ? 'flex-1 ' : ''}bg-ink-900 border border-ink-700/80 rounded-2xl overflow-hidden`}
    >
      <View className={fullScreen ? 'relative flex-1' : 'relative'}>
        <Svg
          width="100%"
          height={fullScreen ? '100%' : H}
          viewBox={`0 0 ${W} ${svgH}`}
          preserveAspectRatio={fullScreen ? 'xMidYMid meet' : undefined}
        >
          <Rect x={-W} y={-svgH} width={W * 3} height={svgH * 3} fill={colors.ink[900]} />
          {/* Grade tática de telemetria */}
          <Line x1={-W} y1={60} x2={W * 2} y2={60} stroke={colors.ink[800]} strokeWidth={1} />
          <Line x1={-W} y1={120} x2={W * 2} y2={120} stroke={colors.ink[800]} strokeWidth={1} />
          <Line x1={-W} y1={180} x2={W * 2} y2={180} stroke={colors.ink[800]} strokeWidth={1} />
          {fullScreen ? (
            <>
              <Line x1={-W} y1={240} x2={W * 2} y2={240} stroke={colors.ink[800]} strokeWidth={1} />
              <Line x1={-W} y1={300} x2={W * 2} y2={300} stroke={colors.ink[800]} strokeWidth={1} />
              <Line x1={-W} y1={360} x2={W * 2} y2={360} stroke={colors.ink[800]} strokeWidth={1} />
            </>
          ) : null}
          <Line x1={90} y1={-svgH} x2={90} y2={svgH * 2} stroke={colors.ink[800]} strokeWidth={1} />
          <Line x1={180} y1={-svgH} x2={180} y2={svgH * 2} stroke={colors.ink[800]} strokeWidth={1} />
          <Line x1={270} y1={-svgH} x2={270} y2={svgH * 2} stroke={colors.ink[800]} strokeWidth={1} />

          {/* Traçado da rodovia */}
          <Polyline
            points={pts}
            fill="none"
            stroke={colors.ink[700]}
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Polyline
            points={pts}
            fill="none"
            stroke={colors.brand[400]}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Polyline
            points={pts}
            fill="none"
            stroke={colors.brand[50]}
            strokeOpacity={0.5}
            strokeWidth={1.2}
            strokeDasharray="6 6"
          />

          {/* Geocerca de Origem */}
          <Circle cx={o.x} cy={o.y} r={16} fill={colors.brand[300]} opacity={0.16} />
          <Circle cx={o.x} cy={o.y} r={6} fill={colors.brand[300]} stroke={colors.ink[950]} strokeWidth={2} />

          {/* Geocerca de Destino */}
          <Circle cx={d.x} cy={d.y} r={22} fill={colors.wait[500]} opacity={0.16} />
          <Circle
            cx={d.x}
            cy={d.y}
            r={14}
            fill="none"
            stroke={colors.wait[500]}
            strokeOpacity={0.45}
            strokeWidth={1.2}
            strokeDasharray="3 3"
          />
          <Circle cx={d.x} cy={d.y} r={6.5} fill={colors.wait[500]} stroke={colors.ink[950]} strokeWidth={2} />

          {/* Posição atual do caminhão */}
          <Circle cx={truck.x} cy={truck.y} r={15} fill={colors.brand[300]} opacity={0.25} />
          <Circle cx={truck.x} cy={truck.y} r={8.5} fill={colors.ink[50]} stroke={colors.brand[300]} strokeWidth={3.5} />
        </Svg>

        {/* Overlay superior flutuante: Fase à esquerda, Distância à direita */}
        <View className="absolute top-3 left-3 right-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5 bg-ink-950/85 border border-ink-700/80 rounded-full px-3 py-1.5">
            <View className={`w-2 h-2 rounded-full ${phaseDotColor[phase]}`} />
            <Text className="text-ink-50 text-xs font-semibold">{t(`trip.phase.${phase}`)}</Text>
          </View>
          <View className="bg-ink-950/85 border border-ink-700/80 rounded-full px-3 py-1.5 flex-row items-center gap-1.5">
            <Text
              className="text-brand-300 text-xs font-bold"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {t('trip.left', { km: leftKm.toFixed(1) })}
            </Text>
            {computedEta > 0 && (
              <Text
                className="text-ink-300 text-xs font-semibold"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                · {t('map.etaShort', { min: computedEta })}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Rodapé com Origem -> Destino */}
      <View className="flex-row items-center justify-between px-3.5 py-2.5 border-t border-ink-700/80 bg-ink-900 gap-2">
        <View className="flex-1 flex-row items-center gap-1.5">
          <View className="w-2 h-2 rounded-full bg-brand-500" />
          <Text numberOfLines={1} className="flex-1 text-ink-50 text-xs font-medium">
            {activeRoute.origin.name}
          </Text>
        </View>
        <View className="bg-ink-800 border border-ink-700 rounded-full px-2 py-0.5">
          <Text numberOfLines={1} className="text-ink-300 text-[10px] font-semibold">
            {badgeLabel ?? t('trip.mapMock')}
          </Text>
        </View>
        <View className="flex-1 flex-row items-center justify-end gap-1.5">
          <Text numberOfLines={1} className="flex-1 text-right text-ink-50 text-xs font-medium">
            {activeRoute.destination.name}
          </Text>
          <View className="w-2 h-2 rounded-full bg-wait-500" />
        </View>
      </View>
    </View>
  );
}
