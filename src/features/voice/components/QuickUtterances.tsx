import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { getCurrentLanguage } from '../../../lib/i18n';
import { useVoice } from '../hooks/useVoice';
import { getQuickUtterances } from '../api/agentMock';

/** Mock do reconhecimento de voz: o motorista "fala" tocando numa frase pronta (bilíngue pt-BR / en). */
export function QuickUtterances() {
  const { t } = useTranslation();
  const state = useVoice((s) => s.state);
  const preferredMode = useVoice((s) => s.preferredMode);
  const activeMode = useVoice((s) => s.activeMode);
  const sessionConnected = useVoice((s) => s.sessionConnected);
  const context = useVoice((s) => s.context);
  const utter = useVoice((s) => s.utter);

  if (
    state !== 'listening' ||
    (activeMode === 'agora' && sessionConnected) ||
    preferredMode === 'agora'
  ) {
    return null;
  }

  const lang = getCurrentLanguage();
  const contextUtterances = getQuickUtterances(context, lang);
  const freeUtterances = getQuickUtterances('free', lang);
  const options = [...contextUtterances, ...(context === 'free' ? [] : freeUtterances.slice(0, 1))];

  return (
    <View className="mt-3 pt-2.5 border-t border-ink-700/70">
      <Text className="text-ink-300 text-[11px] font-semibold mb-2">
        {t('voice.quickPromptsLabel')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {options.map((u) => (
          <Pressable
            key={u}
            onPress={() => utter(u)}
            className="flex-row items-center gap-1.5 bg-ink-800 border border-brand-500/40 active:bg-brand-500/20 rounded-full px-4 py-2.5 mr-2"
          >
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2"
                stroke="#099DFD"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
            <Text className="text-ink-50 text-xs font-medium">“{u}”</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
