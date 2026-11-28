import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useVoiceCommandToast } from '../services/voiceCommands';
import { colors } from '../lib/theme';

/** Banner discreto no topo indicando quando um comando de voz automatizou uma navegação ou ação. */
export function VoiceCommandToast() {
  const message = useVoiceCommandToast((s) => s.message);
  const clear = useVoiceCommandToast((s) => s.clear);

  if (!message) return null;

  return (
    <Pressable
      onPress={clear}
      accessibilityRole="alert"
      className="bg-brand-500/20 border-b border-brand-500/60 px-4 py-2 flex-row items-center justify-between"
    >
      <View className="flex-row items-center gap-2 flex-1 pr-2">
        <View className="w-6 h-6 rounded-full bg-brand-500/25 border border-brand-500/50 items-center justify-center">
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v3"
              stroke={colors.brand[300]}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
        <Text numberOfLines={1} className="text-ink-50 text-sm font-bold flex-1">
          {message}
        </Text>
      </View>
    </Pressable>
  );
}
