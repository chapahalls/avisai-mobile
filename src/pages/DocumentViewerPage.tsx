import { Alert, Linking, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { DOCUMENTS, MockPdfViewer, useDocuments } from '../features/documents';
import { useVoice } from '../features/voice';
import { hapticTap } from '../utils/haptics';
import type { RootStackParams } from '../app/navigation';

export function DocumentViewerPage({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParams, 'DocumentViewer'>) {
  const { t } = useTranslation();
  const documents = useDocuments((s) => s.documents);
  const doc =
    documents.find(
      (d) =>
        d.id === route.params.id ||
        (route.params.id === 'nfe-1' && d.kind === 'NF-e') ||
        (route.params.id === 'cte-1' && d.kind === 'CT-e'),
    ) ??
    documents[0] ??
    DOCUMENTS[0];

  const handleAskAvisai = () => {
    hapticTap();
    const voice = useVoice.getState();
    voice.setContext('free');
    voice.pushTranscript('agent', t('documents.askPromptForDoc', { title: doc.title }));
    if (voice.state === 'idle' && !voice.sessionConnected) {
      voice.listen();
    }
    navigation.navigate('Main', { screen: 'Trip' });
  };

  const handleOpenFile = async () => {
    if (!doc.fileUrl) return;
    hapticTap();
    try {
      const supported = await Linking.canOpenURL(doc.fileUrl);
      if (!supported) throw new Error('unsupported_file_url');
      await Linking.openURL(doc.fileUrl);
    } catch {
      Alert.alert(t('documents.openFileErrorTitle'), t('documents.openFileError'));
    }
  };

  return (
    <View className="flex-1 bg-ink-950">
      {doc.fileUrl ? (
        <View className="flex-1 p-4 justify-between">
          <View className="bg-ink-900 border border-ink-700/80 rounded-2xl p-5">
            <Text className="text-ink-50 text-lg font-bold">{doc.title}</Text>
            <Text className="text-ink-300 text-sm mt-2">{t('documents.realFileNotice')}</Text>
            {doc.description ? (
              <Text className="text-ink-100 text-sm mt-4">{doc.description}</Text>
            ) : null}
            {doc.mimeType ? (
              <Text className="text-ink-300 text-xs mt-4">{doc.mimeType}</Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => void handleOpenFile()}
            accessibilityRole="button"
            className="bg-brand-500 active:opacity-85 rounded-2xl py-3.5 px-4 flex-row items-center justify-center gap-2"
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"
                stroke="#F4F6FA"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text className="text-ink-50 text-sm font-bold">{t('documents.openRealFileButton')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <MockPdfViewer doc={doc} />
          <View className="px-4 py-3 bg-ink-900 border-t border-ink-700/80">
            <Pressable
              onPress={handleAskAvisai}
              accessibilityRole="button"
              className="bg-brand-500 active:opacity-85 rounded-2xl py-3.5 px-4 flex-row items-center justify-center gap-2"
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v3"
                  stroke="#F4F6FA"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text className="text-ink-50 text-sm font-bold">
                {t('documents.askAboutDocumentButton')}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
