import { Alert, Linking, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParams } from '../app/navigation';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { DOCUMENTS, MockPdfViewer, useDocuments } from '../features/documents';
import { useAvisaiDock, useVoice } from '../features/voice';
import { colors } from '../lib/theme';
import { hapticTap } from '../utils/haptics';
import { useBottomInset } from '../utils/layout';

/** Documento aberto (mockup `10-documento-guiado`), também quando o AvisAI abre por voz. */
export function DocumentViewerPage({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParams, 'DocumentViewer'>) {
  const { t } = useTranslation();
  const documents = useDocuments((s) => s.documents);
  const openPanel = useAvisaiDock((s) => s.openPanel);
  const bottomInset = useBottomInset();
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
    openPanel();
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
        <View className="flex-1 p-4">
          <View className="bg-ink-900 border border-ink-800 rounded-3xl p-5">
            <Text className="text-ink-50 text-2xl font-display">{doc.title}</Text>
            <Text className="text-ink-300 text-base mt-2 leading-6">{t('documents.realFileNotice')}</Text>
            {doc.description ? (
              <Text className="text-ink-50 text-base mt-4">{doc.description}</Text>
            ) : null}
            {doc.mimeType ? <Text className="text-ink-300 text-sm mt-4">{doc.mimeType}</Text> : null}
          </View>
        </View>
      ) : (
        <MockPdfViewer doc={doc} />
      )}

      <View className="px-4 pt-3 gap-3 border-t border-ink-800" style={{ paddingBottom: 12 + bottomInset }}>
        {doc.fileUrl ? (
          <Button
            label={t('documents.openRealFileButton')}
            onPress={() => void handleOpenFile()}
            icon={<Icon name="file" size={20} />}
          />
        ) : (
          <Button
            label={t('documents.askAboutDocumentButton')}
            onPress={handleAskAvisai}
            icon={<Icon name="mic" size={20} />}
          />
        )}
        <Button
          variant="outline"
          label={t('documents.allDocuments')}
          onPress={() => navigation.goBack()}
          icon={<Icon name="chevronLeft" size={18} color={colors.ink[300]} />}
        />
      </View>
    </View>
  );
}
