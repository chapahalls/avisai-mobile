import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { OutboxList, retryFailed, useOutboxStore } from '../features/outbox';
import { useSession } from '../features/auth';

export function OutboxPage() {
  const { t } = useTranslation();
  const refresh = useOutboxStore((s) => s.refresh);
  const logout = useSession((s) => s.logout);
  return (
    <Screen scroll={false}>
      <View className="flex-1 p-4">
        <Text className="text-ink-50 text-xl font-semibold">{t('outbox.title')}</Text>
        <Text className="text-ink-300 text-sm mb-3">{t('outbox.hint')}</Text>
        <OutboxList />
        <View className="gap-2 mt-2">
          <Button label={t('outbox.retry')} variant="ghost" onPress={() => { retryFailed(); refresh(); }} />
          <Button label={t('auth.logout')} variant="ghost" onPress={logout} />
        </View>
      </View>
    </Screen>
  );
}
