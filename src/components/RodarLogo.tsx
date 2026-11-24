import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../lib/theme';

/**
 * Contorno do símbolo RODAR (fonte: rodar-web/docs/RODAR-telas/marca/rodar-icone.svg).
 * O "R" é vazado (`fillRule="evenodd"`): mostra o fundo atrás do símbolo.
 */
export const RODAR_MARK_PATH =
  'M158 0L740 0A35 35 0 0 1 775 35L775 578.5A52 52 0 0 1 759.8 615.2L591.2 783.8A52 52 0 0 1 554.5 799L35 799A35 35 0 0 1 0 764L0 158A70 70 0 0 1 20.5 108.5L108.5 20.5A70 70 0 0 1 158 0ZM167.9 149.9L298.2 149.9A4 4 0 0 1 301.1 151.1L380.2 230.2A11.5 11.5 0 0 0 399.8 222L399.8 155.9A6 6 0 0 1 405.8 149.9L464 149.9C580.8 149.9 621.3 218 621.3 310.5C621.3 425.9 578.1 442 539 469L621.1 626A16 16 0 0 1 606.9 649.4L494.2 649.4A8 8 0 0 1 487.1 645.1L413.4 504.3A30 30 0 0 0 408 497L315.8 404.8A17.1 17.1 0 0 1 327.9 375.6L455.8 375.6A30 30 0 0 0 485.8 345.6L485.8 289.3A30 30 0 0 0 455.8 259.3L296.1 259.3A12 12 0 0 0 284.1 271.3L284.1 631.4A18 18 0 0 1 266.1 649.4L167.9 649.4A18 18 0 0 1 149.9 631.4L149.9 167.9A18 18 0 0 1 167.9 149.9Z';

const MARK_ASPECT = 775 / 799;

/**
 * Símbolo RODAR: bloco lima com cantos chanfrados e o "R" vazado, sempre na cor `rodar.mark`.
 * Com `label`, é uma imagem com nome acessível; sem ele, é decorativo.
 */
export function RodarMark({ size, label }: { size: number; label?: string }) {
  return (
    <View
      accessible={Boolean(label)}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    >
      <Svg width={size * MARK_ASPECT} height={size} viewBox="0 0 775 799">
        <Path fill={colors.rodar.mark} fillRule="evenodd" d={RODAR_MARK_PATH} />
      </Svg>
    </View>
  );
}

/**
 * Assinatura RODAR (mesmas proporções do web): símbolo + palavra "RODAR" em Kumbh Sans.
 * `size` é a altura do símbolo; o corpo da palavra é ≈ 0,724 × `size` (maiúscula ≈ 0,53)
 * e o espaço entre os dois é ≈ 0,2 × `size`. `tagline` aparece abaixo da palavra.
 */
export function RodarLogo({ size, tagline }: { size: number; tagline?: string }) {
  const { t } = useTranslation();
  const fontSize = Math.round(size * 0.724);
  return (
    <View
      className="flex-row items-center shrink"
      style={{ gap: Math.round(size * 0.2) }}
      accessible
      accessibilityRole="header"
      accessibilityLabel={tagline ? `${t('brand.name')}, ${tagline}` : t('brand.name')}
    >
      <RodarMark size={size} />
      {/* `shrink`: com fonte grande a assinatura quebra a linha em vez de empurrar o que está ao lado. */}
      <View className="shrink">
        <Text
          allowFontScaling={false}
          className="font-brand text-ink-50"
          style={{ fontSize, lineHeight: Math.round(fontSize * 1.05), letterSpacing: fontSize * 0.01 }}
        >
          {t('brand.name')}
        </Text>
        {tagline ? <Text className="text-ink-300 text-sm">{tagline}</Text> : null}
      </View>
    </View>
  );
}
