import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { colors, withAlpha } from '../lib/theme';

// Vitest roda na raiz do projeto (como `npm test`).
const requireFromRoot = createRequire(`${process.cwd()}/`);
const tailwind = requireFromRoot('./tailwind.config.js') as {
  theme: { extend: { colors: Record<string, Record<string, string>> } };
};

describe('tokens de cor', () => {
  it('tailwind.config.js e src/lib/theme.ts têm os mesmos valores', () => {
    const fromTailwind = tailwind.theme.extend.colors;
    for (const [group, shades] of Object.entries(colors)) {
      for (const [shade, hex] of Object.entries(shades)) {
        expect(fromTailwind[group]?.[shade]?.toUpperCase(), `${group}-${shade}`).toBe(hex);
      }
    }
    expect(Object.keys(fromTailwind).sort()).toEqual(Object.keys(colors).sort());
  });

  it('segue a paleta RODAR do web (verde/lima, não o azul antigo)', () => {
    expect(colors.brand[500]).toBe('#3D7A52');
    expect(colors.ink[950]).toBe('#090B09');
    expect(colors.rodar.mark).toBe('#A2F200');
  });

  it('withAlpha converte opacidade em sufixo hexadecimal', () => {
    expect(withAlpha('#3D7A52', 0.18)).toBe('#3D7A522E');
    expect(withAlpha('#F5A524', 1)).toBe('#F5A524FF');
    expect(withAlpha('#F5A524', 0)).toBe('#F5A52400');
  });
});
