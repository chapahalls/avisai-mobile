import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';

interface Props {
  size?: 'sm' | 'md' | 'lg';
}

export function BrandLogo({ size = 'md' }: Props) {
  const { t } = useTranslation();
  const iconDim = size === 'lg' ? 40 : size === 'sm' ? 28 : 34;
  const textClass =
    size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg';

  return (
    <View className="flex-row items-center gap-2.5">
      <View
        style={{ width: iconDim, height: iconDim }}
        className="rounded-xl bg-brand-500/15 border border-brand-500/40 items-center justify-center"
      >
        <Svg width={iconDim * 0.65} height={iconDim * 0.65} viewBox="0 0 24 24" fill="none">
          {/* Pino de rota central */}
          <Path
            d="M12 3C8.96 3 6.5 5.46 6.5 8.5c0 4.1 5.5 10.5 5.5 10.5s5.5-6.4 5.5-10.5C17.5 5.46 15.04 3 12 3Z"
            stroke="#099DFD"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={8.5} r={2} fill="#38BDF8" />
          {/* Ondas sonoras laterais */}
          <Path
            d="M3.5 6.5a8.5 8.5 0 0 0 0 6M20.5 6.5a8.5 8.5 0 0 1 0 6"
            stroke="#38BDF8"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </Svg>
      </View>
      <Text className={`${textClass} font-bold tracking-tight text-ink-50`}>
        {t('brand.name')}
      </Text>
    </View>
  );
}
