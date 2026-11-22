import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Screen } from '../components/Screen';
import { DocumentList } from '../features/documents';
import type { RootStackParams } from '../app/navigation';

export function DocumentsPage() {
  const { t } = useTranslation();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  return (
    <Screen>
      <Text className="text-ink-50 text-xl font-semibold">{t('documents.title')}</Text>
      <Text className="text-ink-300 text-sm">{t('documents.hint')}</Text>
      <DocumentList onOpen={(d) => nav.navigate('DocumentViewer', { id: d.id })} />
    </Screen>
  );
}
