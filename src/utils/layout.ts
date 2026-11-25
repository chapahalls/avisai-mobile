import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LAYOUT } from '../lib/config';

/**
 * Tela "apertada": pouca largura para o tamanho de fonte escolhido no aparelho
 * (celular pequeno ou fonte grande de acessibilidade). Nesses casos os layouts em
 * colunas viram lista e os elementos do cabeçalho descem de linha.
 */
export function isCompactWidth(widthDp: number, fontScale: number): boolean {
  return widthDp / Math.max(fontScale, 0.5) < LAYOUT.compactWidthDp;
}

export function useCompactLayout(): boolean {
  const { width, fontScale } = useWindowDimensions();
  return isCompactWidth(width, fontScale);
}

/** Espaço da barra de navegação do Android (gestos ou botões) para o rodapé não ficar embaixo dela. */
export function useBottomInset(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 10);
}
