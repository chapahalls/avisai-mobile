import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ useWindowDimensions: () => ({ width: 384, fontScale: 1 }) }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));

import { isCompactWidth } from '../utils/layout';

describe('isCompactWidth', () => {
  it('celular comum com fonte normal não é compacto', () => {
    expect(isCompactWidth(384, 1)).toBe(false);
    expect(isCompactWidth(360, 1)).toBe(false);
  });
  it('fonte grande ou tela estreita vira compacto', () => {
    expect(isCompactWidth(384, 1.3)).toBe(true);
    expect(isCompactWidth(320, 1)).toBe(true);
  });
});
