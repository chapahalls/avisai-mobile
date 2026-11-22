import { Pressable, Text, View } from 'react-native';
import { DOCUMENTS } from '../api/documents.mock';
import { Badge } from '../../../components/Badge';
import type { MockDocument } from '../types';

export function DocumentList({ onOpen }: { onOpen: (d: MockDocument) => void }) {
  return (
    <View>
      {DOCUMENTS.map((d) => (
        <Pressable key={d.id} onPress={() => onOpen(d)} className="bg-ink-900 border border-ink-700 rounded-card p-4 mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-ink-50 font-semibold">{d.title}</Text>
            <Text className="text-ink-300 text-xs">{Object.keys(d.fields).length} campos extraídos</Text>
          </View>
          <Badge tone="brand" label={d.kind} />
        </Pressable>
      ))}
    </View>
  );
}
