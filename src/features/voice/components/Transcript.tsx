import { ScrollView, Text, View } from 'react-native';
import { useVoice } from '../hooks/useVoice';

export function Transcript() {
  const lines = useVoice((s) => s.transcript);
  return (
    <ScrollView className="max-h-48" contentContainerStyle={{ paddingVertical: 4 }}>
      {lines.slice(-6).map((l) => (
        <View key={l.id} className={`mb-2 max-w-[85%] rounded-card px-3 py-2 ${l.who === 'agent' ? 'bg-ink-800 self-start' : 'bg-brand-600 self-end'}`}>
          <Text className="text-ink-50 text-sm">{l.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
