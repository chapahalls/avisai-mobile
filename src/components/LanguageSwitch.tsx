import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getCurrentLanguage, setAppLanguage, type AppLanguage } from '../lib/i18n';

const LANGS: { code: AppLanguage; labelKey: 'lang.ptShort' | 'lang.enShort'; a11yKey: 'lang.ptBR' | 'lang.en' }[] = [
  { code: 'pt-BR', labelKey: 'lang.ptShort', a11yKey: 'lang.ptBR' },
  { code: 'en', labelKey: 'lang.enShort', a11yKey: 'lang.en' },
];

export function LanguageSwitch() {
  const { t } = useTranslation();
  const current = getCurrentLanguage();

  return (
    <View className="flex-row items-center bg-ink-900 border border-ink-700 rounded-full p-0.5 self-start">
      {LANGS.map(({ code, labelKey, a11yKey }) => {
        const active = current === code;
        return (
          <Pressable
            key={code}
            onPress={() => void setAppLanguage(code)}
            accessibilityRole="button"
            accessibilityLabel={t(a11yKey)}
            className={`px-2.5 py-1 rounded-full ${active ? 'bg-brand-500' : 'bg-transparent'}`}
          >
            <Text className={`text-xs font-bold ${active ? 'text-ink-50' : 'text-ink-300'}`}>
              {t(labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
