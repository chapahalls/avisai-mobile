import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import { BrandLogo } from '../components/BrandLogo';
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
        <View className="flex-row items-center justify-between">
          <BrandLogo size="md" />
          <LanguageSwitch />
        </View>

        {/* Center Hero */}
        <View className="flex-1 justify-center my-4">
          <View className="items-center mb-4">
            <Svg width={104} height={104} viewBox="0 0 120 120" fill="none">
              <Circle cx={60} cy={60} r={54} stroke="#099DFD" strokeOpacity={0.14} strokeWidth={1.5} />
              <Circle
                cx={60}
                cy={60}
                r={42}
                stroke="#099DFD"
                strokeOpacity={0.28}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              <Circle cx={60} cy={60} r={29} fill="#099DFD" fillOpacity={0.16} stroke="#099DFD" strokeWidth={2} />
              {/* Ondas de voz + rota central */}
              <Path
                d="M60 46c-5 0-9 4-9 9 0 6.5 9 16 9 16s9-9.5 9-16c0-5-4-9-9-9Z"
                stroke="#F4F6FA"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Circle cx={60} cy={55} r={3} fill="#099DFD" />
              <Path
                d="M44 50a14 14 0 0 0 0 12M76 50a14 14 0 0 1 0 12"
                stroke="#38BDF8"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
          </View>

          <Text className="text-ink-50 text-3xl font-bold tracking-tight text-center">
            {t('auth.title')}
          </Text>
          <Text className="text-ink-300 text-base text-center mt-1.5 leading-6 px-2">
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
