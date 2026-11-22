import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SsoButton } from '../features/auth';

export function LoginPage() {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-ink-950 px-6 justify-center">
      <Text className="text-brand-500 text-sm font-semibold">AvisAI</Text>
      <Text className="text-ink-50 text-3xl font-bold mt-2">{t('auth.title')}</Text>
      <Text className="text-ink-300 mt-2 mb-8">{t('auth.subtitle')}</Text>
      <SsoButton />
      <View className="mt-6">
        <Text className="text-ink-300 text-xs">{t('auth.mockNotice')}</Text>
      </View>
    </SafeAreaView>
  );
}
