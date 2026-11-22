import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DOCUMENTS, MockPdfViewer } from '../features/documents';
import type { RootStackParams } from '../app/navigation';

export function DocumentViewerPage({ route }: NativeStackScreenProps<RootStackParams, 'DocumentViewer'>) {
  const doc = DOCUMENTS.find((d) => d.id === route.params.id) ?? DOCUMENTS[0];
  return (
    <View className="flex-1 bg-ink-950">
      <MockPdfViewer doc={doc} />
    </View>
  );
}
