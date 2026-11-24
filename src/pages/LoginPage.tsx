import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { RodarLogo } from '../components/RodarLogo';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { ProfileSwitcher, SsoButton } from '../features/auth';

export function LoginPage() {
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-ink-950">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingVertical: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View className="flex-row items-start justify-between gap-3">
          <RodarLogo size={44} tagline={t('brand.tagline')} />
          <LanguageSwitch />
        </View>

        {/* Título logo abaixo da assinatura, como no mockup 02-login */}
        <View className="flex-1 mt-8 mb-4">
          <Text className="text-ink-50 text-3xl font-bold tracking-tight">
            {t('auth.title')}
          </Text>
          <Text className="text-ink-300 text-base mt-1.5 leading-6">
            {t('auth.subtitle')}
          </Text>
        </View>

        {/* Anchored Footer CTA */}
        <View className="bg-ink-900 border border-ink-700/80 rounded-2xl p-3.5 mt-1">
          <ProfileSwitcher />
          <SsoButton />
          <View className="flex-row items-center justify-center gap-1.5 mt-2.5">
            <View className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            <Text className="text-ink-300 text-xs text-center">{t('auth.mockNotice')}</Text>
          </View>
        </View>

        <Text className="text-ink-300/70 text-xs text-center font-medium mt-3">
          {t('brand.poweredBy')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
