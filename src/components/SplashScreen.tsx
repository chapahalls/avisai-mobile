import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';
import { colors } from '../lib/theme';
import { RodarMark } from './RodarLogo';

/** Duração da barra de carregamento da abertura. */
export const SPLASH_MS = 1400;

/** Trilhas de circuito saindo do símbolo (viewBox 390×844, mockup `01-abertura`). */
const TRACES = [
  'M95 0v170l40 40v120',
  'M133 0v178l26 26v120',
  'M258 0v150l-26 26v150',
  'M302 0v150l-48 48v130',
  'M0 240h55l40 40h55',
  'M0 318h150',
  'M390 214h-30l-60 60h-60',
  'M390 252h-22l-60 60h-70',
  'M0 440l75-75h75',
  'M390 395h-45l-30-30h-75',
  'M120 844V520l40-40',
  'M270 844V520l-40-40',
];

/**
 * Abertura do app (mockup `01-abertura`): símbolo RODAR com trilhas de circuito,
 * assinatura e uma barra de carregamento. Com "reduzir movimento", a barra já aparece cheia.
 */
export function SplashScreen({ fontsReady }: { fontsReady: boolean }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withTiming(1, { duration: SPLASH_MS, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotion]);

  const barStyle = useAnimatedStyle(() => ({ width: `${Math.round(progress.value * 100)}%` }));

  return (
    <View
      className="flex-1 bg-ink-950 items-center justify-center px-8"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${t('brand.name')}, ${t('splash.loading')}`}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute' }}
      >
        {Array.from({ length: 9 }, (_, i) => (
          <Line key={`v${i}`} x1={i * 48} y1={0} x2={i * 48} y2={844} stroke={colors.rodar[400]} strokeOpacity={0.06} />
        ))}
        {Array.from({ length: 18 }, (_, i) => (
          <Line key={`h${i}`} x1={0} y1={i * 48} x2={390} y2={i * 48} stroke={colors.rodar[400]} strokeOpacity={0.06} />
        ))}
        {TRACES.map((d) => (
          <Path key={d} d={d} stroke={colors.rodar[400]} strokeOpacity={0.4} strokeWidth={1.5} fill="none" />
        ))}
      </Svg>

      <View
        style={{
          shadowColor: colors.rodar.mark,
          shadowOpacity: 0.55,
          shadowRadius: 40,
          shadowOffset: { width: 0, height: 0 },
          elevation: 24,
        }}
      >
        <RodarMark size={180} />
      </View>

      {fontsReady ? (
        <Text className="text-ink-50 font-brand mt-10" style={{ fontSize: 60, lineHeight: 66, letterSpacing: 0.6 }}>
          {t('brand.name')}
        </Text>
      ) : (
        <View style={{ height: 66 }} className="mt-10" />
      )}
      <Text className="text-ink-300 text-lg mt-3 text-center">{t('brand.tagline')}</Text>

      <View className="w-full h-1.5 rounded-full bg-ink-800 mt-14 overflow-hidden">
        {/* Componente animado do reanimated: estilo por `style`, não por className. */}
        <Animated.View
          style={[{ height: '100%', borderRadius: 999, backgroundColor: colors.rodar[400] }, barStyle]}
        />
      </View>
      <Text className="text-ink-300 text-xs font-mono mt-4 text-center">{t('splash.loading')}</Text>
    </View>
  );
}
