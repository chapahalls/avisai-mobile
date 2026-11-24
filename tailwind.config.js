/** Tokens do RODAR. Mesmos valores do repositório web (rodar-web/src/index.css) e de src/lib/theme.ts. */
module.exports = {
  content: ['./index.ts', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#E8F2EA', 300: '#7FD19C', 400: '#4FAE74', 500: '#3D7A52', 600: '#285C3B' },
        ink: { 950: '#090B09', 900: '#111511', 800: '#1C231D', 700: '#354037', 300: '#AEB8B0', 50: '#F6F8F6' },
        wait: { 500: '#F5A524' },
        alert: { 500: '#F04438' },
        ok: { 500: '#17B26A' },
        rodar: { mark: '#A2F200', 400: '#9BE22D' },
        info: { 300: '#9CC2F7', 900: '#13223A' },
      },
      fontFamily: {
        // Só a palavra "RODAR" da assinatura (src/components/RodarLogo.tsx).
        brand: ['KumbhSans_700Bold'],
        // Títulos e números grandes. Nunca combinar com `font-bold`/`font-semibold`:
        // no Android o peso extra faz o RN cair na fonte do sistema.
        display: ['SpaceGrotesk_700Bold'],
      },
      borderRadius: { card: '12px', input: '8px' },
    },
  },
  plugins: [],
};
