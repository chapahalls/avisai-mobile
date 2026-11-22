/** Tokens do AvisAI (inspirados na Agora). Mesmos valores do repositório web. */
module.exports = {
  content: ['./index.ts', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#E6F5FF', 500: '#099DFD', 600: '#0780D0' },
        ink: { 950: '#0B1220', 900: '#121A2B', 800: '#1A2438', 700: '#2A3550', 300: '#A7B1C6', 50: '#F4F6FA' },
        wait: { 500: '#F5A524' },
        alert: { 500: '#F04438' },
        ok: { 500: '#17B26A' },
      },
      borderRadius: { card: '12px', input: '8px' },
    },
  },
  plugins: [],
};
