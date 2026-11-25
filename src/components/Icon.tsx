import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../lib/theme';

/** Ícones de traço (estilo dos mockups RODAR-telas). Decorativos: o texto ao lado dá o sentido. */
export type IconName =
  | 'home'
  | 'map'
  | 'file'
  | 'message'
  | 'phone'
  | 'list'
  | 'play'
  | 'mic'
  | 'x'
  | 'chevronLeft'
  | 'chevronRight'
  | 'arrowRight'
  | 'crosshair'
  | 'sliders'
  | 'check'
  | 'alert'
  | 'clock'
  | 'navigation'
  | 'send'
  | 'logout'
  | 'refresh'
  | 'speaker';

function glyph(name: IconName, c: string) {
  const s = { stroke: c, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home':
      return <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z" {...s} />;
    case 'map':
      return <Path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Zm0 0v13m6-10.5v13" {...s} />;
    case 'file':
      return (
        <>
          <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" {...s} />
          <Path d="M14 3v5h5M9 13h6M9 17h4" {...s} />
        </>
      );
    case 'message':
      return <Path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.4A8.5 8.5 0 1 1 21 11.5Z" {...s} />;
    case 'phone':
      return (
        <Path
          d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"
          {...s}
        />
      );
    case 'list':
      return <Path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" {...s} />;
    case 'play':
      return <Path d="M6 4l14 8-14 8V4Z" {...s} />;
    case 'mic':
      return (
        <>
          <Rect x={9} y={2.5} width={6} height={12} rx={3} {...s} />
          <Path d="M19 10.5v1a7 7 0 0 1-14 0v-1M12 18.5V22" {...s} />
        </>
      );
    case 'x':
      return <Path d="M18 6 6 18M6 6l12 12" {...s} />;
    case 'chevronLeft':
      return <Path d="M15 18l-6-6 6-6" {...s} />;
    case 'chevronRight':
      return <Path d="M9 18l6-6-6-6" {...s} />;
    case 'arrowRight':
      return <Path d="M5 12h14M13 6l6 6-6 6" {...s} />;
    case 'crosshair':
      return (
        <>
          <Circle cx={12} cy={12} r={4} {...s} />
          <Path d="M12 2v4M12 18v4M2 12h4M18 12h4" {...s} />
        </>
      );
    case 'sliders':
      return (
        <>
          <Path d="M4 7h10M18 7h2M4 17h4M12 17h8" {...s} />
          <Circle cx={16} cy={7} r={2} {...s} />
          <Circle cx={10} cy={17} r={2} {...s} />
        </>
      );
    case 'check':
      return <Path d="M5 12.5l4.5 4.5L19 7.5" {...s} />;
    case 'alert':
      return (
        <>
          <Circle cx={12} cy={12} r={9} {...s} />
          <Path d="M12 7.5v5M12 16.3h.01" {...s} />
        </>
      );
    case 'clock':
      return (
        <>
          <Circle cx={12} cy={12} r={9} {...s} />
          <Path d="M12 7v5l3 2" {...s} />
        </>
      );
    case 'navigation':
      return <Path d="M3 11 21 3l-8 18-2-8-8-2Z" {...s} />;
    case 'send':
      return <Path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" {...s} />;
    case 'logout':
      return <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" {...s} />;
    case 'refresh':
      return <Path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" {...s} />;
    case 'speaker':
      return <Path d="M11 5 6 9H2v6h4l5 4V5Zm4.5 3.5a5 5 0 0 1 0 7m3.5-10.5a10 10 0 0 1 0 14" {...s} />;
  }
}

export function Icon({
  name,
  size = 22,
  color = colors.ink[50],
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {glyph(name, color)}
    </Svg>
  );
}
