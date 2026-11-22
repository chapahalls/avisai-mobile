import { Pressable, ScrollView, Text } from 'react-native';
import { useVoice } from '../hooks/useVoice';
import { QUICK_UTTERANCES } from '../api/agentMock';

/** Mock do reconhecimento de voz: no Expo Go o motorista "fala" tocando numa frase pronta. */
export function QuickUtterances() {
  const { state, context, utter } = useVoice();
  if (state !== 'listening') return null;
  const options = [...QUICK_UTTERANCES[context], ...(context === 'free' ? [] : QUICK_UTTERANCES.free.slice(0, 1))];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
      {options.map((u) => (
        <Pressable key={u} onPress={() => utter(u)} className="bg-ink-800 border border-ink-700 rounded-full px-4 py-2 mr-2">
          <Text className="text-ink-50 text-sm">“{u}”</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
