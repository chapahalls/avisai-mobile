import { View, Text } from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { ROUTE } from '../api/route.mock';
import { useTrip } from '../hooks/useTrip';
import type { LatLng } from '../../../types/geo';

const W = 340;
const H = 220;
const PAD = 24;

/**
 * Mapa MOCK desenhado em SVG (react-native-maps com Google não roda no Expo Go).
 * Dev build: trocar por <MapView provider={PROVIDER_GOOGLE}> com <Polyline>, <Marker> e <Circle> nas mesmas coordenadas.
 */
export function RouteMap() {
  const { t } = useTranslation();
  const position = useTrip((s) => s.position);
  const lats = ROUTE.path.map((p) => p.lat);
  const lngs = ROUTE.path.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const project = (p: LatLng) => ({
    x: PAD + ((p.lng - minLng) / (maxLng - minLng)) * (W - 2 * PAD),
    y: PAD + ((maxLat - p.lat) / (maxLat - minLat)) * (H - 2 * PAD),
  });
  const pts = ROUTE.path.map(project).map((p) => `${p.x},${p.y}`).join(' ');
  const o = project(ROUTE.origin.position);
  const d = project(ROUTE.destination.position);
  const truck = project(position);
  return (
    <View className="bg-ink-900 border border-ink-700 rounded-card overflow-hidden">
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={0} y={0} width={W} height={H} fill="#121A2B" />
        <Polyline points={pts} fill="none" stroke="#2A3550" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points={pts} fill="none" stroke="#099DFD" strokeWidth={2} strokeDasharray="6 6" />
        <Circle cx={o.x} cy={o.y} r={14} fill="#099DFD" opacity={0.15} />
        <Circle cx={d.x} cy={d.y} r={18} fill="#F5A524" opacity={0.18} />
        <Circle cx={o.x} cy={o.y} r={5} fill="#099DFD" />
        <Circle cx={d.x} cy={d.y} r={6} fill="#F5A524" />
        <Circle cx={truck.x} cy={truck.y} r={8} fill="#F4F6FA" stroke="#099DFD" strokeWidth={3} />
      </Svg>
      <View className="flex-row justify-between px-3 py-2 border-t border-ink-700">
        <Text className="text-ink-300 text-xs">{ROUTE.origin.name}</Text>
        <Text className="text-ink-300 text-xs">{t('trip.mapMock')}</Text>
        <Text className="text-ink-300 text-xs">{ROUTE.destination.name}</Text>
      </View>
    </View>
  );
}
