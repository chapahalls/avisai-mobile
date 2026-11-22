import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ptBR from '../assets/locales/pt-BR.json';
import en from '../assets/locales/en.json';
import { getSetting, setSetting } from './db';

export type AppLanguage = 'pt-BR' | 'en';

function detectDeviceLanguage(): AppLanguage {
  if (process.env.VITEST) return 'pt-BR';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loc = require('expo-localization') as {
      getLocales?: () => Array<{ languageTag?: string }>;
    };
    const tag = loc.getLocales?.()?.[0]?.languageTag ?? 'pt-BR';
    return tag.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
  } catch {
    return 'pt-BR';
  }
}

i18n.use(initReactI18next).init({
  resources: { 'pt-BR': { translation: ptBR }, en: { translation: en } },
  lng: detectDeviceLanguage(),
  fallbackLng: 'pt-BR',
  interpolation: { escapeValue: false },
});

export function getCurrentLanguage(): AppLanguage {
  return i18n.language?.toLowerCase().startsWith('en') ? 'en' : 'pt-BR';
}

export async function setAppLanguage(lang: AppLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
  setSetting('lang', lang);
}

export function loadPersistedLanguage(): void {
  const saved = getSetting('lang');
  if (saved === 'pt-BR' || saved === 'en') {
    void i18n.changeLanguage(saved);
  }
}

export default i18n;
