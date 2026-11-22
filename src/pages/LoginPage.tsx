import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import { BrandLogo } from '../components/BrandLogo';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { ProfileSwitcher, SsoButton } from '../features/auth';

export function LoginPage() {
  const { t } = useTranslation();

  const pillars = [
    {
      key: 'voice',
      title: t('auth.pillars.voiceTitle'),
      desc: t('auth.pillars.voiceDesc'),
      color: '#099DFD',
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
            stroke="#099DFD"
            strokeWidth={2}
          />
          <Path
            d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"
            stroke="#099DFD"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      ),
    },
    {
      key: 'receiver',
      title: t('auth.pillars.receiverTitle'),
      desc: t('auth.pillars.receiverDesc'),
      color: '#17B26A',
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path
            d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92Z"
            stroke="#17B26A"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ),
    },
    {
      key: 'stay',
      title: t('auth.pillars.stayTitle'),
      desc: t('auth.pillars.stayDesc'),
      color: '#F5A524',
      icon: (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={13} r={8} stroke="#F5A524" strokeWidth={2} />
          <Path
            d="M12 9v4l2.5 2.5M9 2h6"
            stroke="#F5A524"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ),
    },
  ];

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

          {/* 3 Propostas de Valor */}
          <View className="mt-4 gap-2">
            {pillars.map((p) => (
              <View
                key={p.key}
                className="flex-row items-center gap-3 bg-ink-900/90 border border-ink-700/80 rounded-2xl p-3"
              >
                <View className="w-9 h-9 rounded-xl bg-ink-800 border border-ink-700 items-center justify-center">
                  {p.icon}
                </View>
                <View className="flex-1">
                  <Text className="text-ink-50 text-sm font-semibold">{p.title}</Text>
                  <Text className="text-ink-300 text-xs mt-0.5 leading-4">{p.desc}</Text>
                </View>
              </View>
            ))}
          </View>
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
