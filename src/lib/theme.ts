/**
 * Tokens de cor do RODAR para quem precisa do valor em JS (SVG, mapa, navegação,
 * sombras). As classes NativeWind usam os mesmos valores em `tailwind.config.js`;
 * o teste `theme.test.ts` garante que os dois não divergem. Referência: rodar-web
 * (`src/index.css`) e `docs/DESIGN.md`.
 */
export const colors = {
  brand: {
    50: '#E8F2EA',
    /** Verde claro: texto de destaque, ícones ativos, links. Contraste ≥ 4,5:1 sobre ink-950. */
    300: '#7FD19C',
    /** Verde médio: traçado da rota, onda de voz. */
    400: '#4FAE74',
    /** Ação primária (fundo de botão com texto ink-50). */
    500: '#3D7A52',
    600: '#285C3B',
  },
  ink: {
    950: '#090B09',
    900: '#111511',
    800: '#1C231D',
    700: '#354037',
    300: '#AEB8B0',
    50: '#F6F8F6',
  },
  wait: { 500: '#F5A524' },
  alert: { 500: '#F04438' },
  ok: { 500: '#17B26A' },
  /** Cores da marca RODAR: `mark` só no símbolo; `400` em destaques da marca. */
  rodar: { mark: '#A2F200', 400: '#9BE22D' },
  /** Azul do CCO (mockups RODAR-telas): mensagens e cards de pessoas da central, nunca ações. */
  info: { 300: '#9CC2F7', 900: '#13223A' },
} as const;

/**
 * Esfera de voz do AvisAI (mockup `RODAR-telas/aplicativo/13-componente-avisai`):
 * degradê verde da marca. Cada estado tem também texto/ícone, nunca só a cor.
 */
export const voiceOrb = {
  highlight: '#D9F3E2',
  mint: '#9FE0B8',
  leaf: '#3F9A63',
  forest: '#1F5A37',
  deep: '#123D25',
  night: '#0B0E0C',
  lime: '#D6F56A',
} as const;

/** `#RRGGBB` + opacidade (0–1) → `#RRGGBBAA`, para fundos translúcidos fora do NativeWind. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  return `${hex}${a.toString(16).padStart(2, '0').toUpperCase()}`;
}
