import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/Icon';
import { RodarMark } from '../../components/RodarLogo';
import { useSession } from '../../features/auth';
import { useTrip } from '../../features/trip';
import { useAvisaiDock, useVoice } from '../../features/voice';
import { colors } from '../../lib/theme';
import { useWakeWord } from '../../services/wakeWord';
import { hapticTap } from '../../utils/haptics';

function greetingKey(
  date: Date,
): 'home.greeting.morning' | 'home.greeting.afternoon' | 'home.greeting.evening' {
  const h = date.getHours();
  if (h < 12) return 'home.greeting.morning';
  if (h < 18) return 'home.greeting.afternoon';
  return 'home.greeting.evening';
}

/**
 * Cabeçalho do Início: símbolo, saudação, ajustes e, na linha de baixo, o estado do AvisAI.
 * O estado tinha a mesma linha do nome e o cortava ("Carl…") em 390 dp.
 */
export function HomeHeader({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useTranslation();
  const voiceState = useVoice((s) => s.state);
  const wakeListening = useWakeWord((s) => s.status === 'listening');
  const session = useSession((s) => s.session);
  const routeDriverName = useTrip((s) => s.activeRoute.driverName);
  const openPanel = useAvisaiDock((s) => s.openPanel);

  const driverName = session?.name || routeDriverName || t('auth.demoDriverName');
  const firstName = driverName.trim().split(/\s+/)[0] || driverName;

  return (
    <>
      <View className="flex-row items-center gap-3">
        <RodarMark size={52} />
        <View className="flex-1">
          <Text numberOfLines={1} className="text-ink-300 text-base">
            {t(greetingKey(new Date()))}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} className="text-ink-50 text-3xl font-display">
            {firstName}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            hapticTap();
            onOpenSettings();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
          className="w-12 h-12 rounded-full bg-ink-900 border border-ink-800 items-center justify-center active:opacity-80"
        >
          <Icon name="sliders" size={20} color={colors.ink[300]} />
        </Pressable>
      </View>

      <View className="flex-row">
        <Pressable
          onPress={() => {
            hapticTap();
            openPanel();
          }}
          accessibilityRole="button"
          accessibilityHint={t('voice.dock.openHint')}
          className="flex-row items-center gap-2 bg-ink-900 border border-ink-800 rounded-full px-4 min-h-12 active:opacity-80"
        >
          <View
            className={`w-2.5 h-2.5 rounded-full ${
              voiceState !== 'idle' ? 'bg-ok-500' : wakeListening ? 'bg-brand-400' : 'bg-ink-300'
            }`}
          />
          <Text className="text-ink-50 text-sm font-semibold">
            {voiceState === 'idle' && wakeListening
              ? t('voice.wake.listening')
              : t('home.avisaiState', { state: t(`voice.state.${voiceState}`) })}
          </Text>
        </Pressable>
      </View>
    </>
  );
}
