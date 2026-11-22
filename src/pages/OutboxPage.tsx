import { Alert, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { OutboxList, retryFailed, useOutboxStore } from '../features/outbox';
import { useSession } from '../features/auth';
import { useTrip } from '../features/trip';
import { hapticTap } from '../utils/haptics';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'MD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function OutboxPage() {
  const { t } = useTranslation();
  const rows = useOutboxStore((s) => s.rows);
  const refresh = useOutboxStore((s) => s.refresh);
  const session = useSession((s) => s.session);
  const logout = useSession((s) => s.logout);
  const activeRoute = useTrip((s) => s.activeRoute);

  const driverName = session?.name || t('auth.demoDriverName');
  const companyName = session?.company || t('auth.demoCompanyName');
  const initials = getInitials(driverName);

  const sentCount = rows.filter((r) => r.status === 'sent').length;
  const queuedCount = rows.filter((r) => r.status === 'pending' || r.status === 'sending').length;
  const failedCount = rows.filter((r) => r.status === 'failed').length;

  const handleConfirmLogout = () => {
    hapticTap();
    if (typeof Alert?.alert === 'function') {
      Alert.alert(
        t('auth.confirmLogout.title'),
        t('auth.confirmLogout.message'),
        [
          { text: t('auth.confirmLogout.cancel'), style: 'cancel' },
          {
            text: t('auth.confirmLogout.confirm'),
            style: 'destructive',
            onPress: () => logout(),
          },
        ],
      );
    } else {
      logout();
    }
  };

  return (
    <Screen scroll={false}>
      <View className="flex-1 px-4 pt-3 pb-4">
        {/* Card de Perfil do Motorista */}
        <Card className="mb-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1 pr-2">
              <View className="w-11 h-11 rounded-full bg-brand-500/20 border border-brand-500/50 items-center justify-center">
                <Text className="text-brand-500 text-sm font-bold">{initials}</Text>
              </View>
              <View className="flex-1">
                <Text numberOfLines={1} className="text-ink-50 text-base font-bold">
                  {driverName}
                </Text>
                <View className="flex-row items-center gap-1.5 mt-0.5">
                  <Text numberOfLines={1} className="text-ink-300 text-xs">
                    {companyName}
                  </Text>
                  <Text className="text-ink-700 text-xs">·</Text>
                  <Text className="text-brand-500 text-xs font-mono font-bold">
                    {activeRoute.plate}
                  </Text>
                </View>
              </View>
            </View>
            <LanguageSwitch />
          </View>

          <View className="mt-3 pt-3 border-t border-ink-700/70 flex-row justify-end">
            <Button
              label={t('auth.logout')}
              variant="ghost"
              size="sm"
              onPress={handleConfirmLogout}
              icon={
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                    stroke="#A7B1C6"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              }
            />
          </View>
        </Card>

        {/* Título e explicação da fila offline-first */}
        <View className="mb-2.5">
          <Text className="text-ink-50 text-xl font-bold tracking-tight">
            {t('outbox.title')}
          </Text>
          <Text className="text-ink-300 text-xs mt-0.5 leading-4">{t('outbox.hint')}</Text>
        </View>

        {/* 3 Mini-Cards de Saúde da Sincronização */}
        <View className="flex-row gap-2.5 mb-3">
          <View className="flex-1 bg-ink-900 border border-ok-500/40 rounded-xl p-2.5">
            <View className="flex-row items-center gap-1.5">
              <View className="w-2 h-2 rounded-full bg-ok-500" />
              <Text className="text-ink-300 text-xs font-medium">{t('outbox.metrics.sent')}</Text>
            </View>
            <Text
              style={{ fontVariant: ['tabular-nums'] }}
              className="text-ok-500 text-xl font-bold mt-1"
            >
              {sentCount}
            </Text>
          </View>

          <View className="flex-1 bg-ink-900 border border-wait-500/40 rounded-xl p-2.5">
            <View className="flex-row items-center gap-1.5">
              <View className="w-2 h-2 rounded-full bg-wait-500" />
              <Text className="text-ink-300 text-xs font-medium">
                {t('outbox.metrics.pending')}
              </Text>
            </View>
            <Text
              style={{ fontVariant: ['tabular-nums'] }}
              className="text-wait-500 text-xl font-bold mt-1"
            >
              {queuedCount}
            </Text>
          </View>

          <View className="flex-1 bg-ink-900 border border-alert-500/40 rounded-xl p-2.5">
            <View className="flex-row items-center gap-1.5">
              <View className="w-2 h-2 rounded-full bg-alert-500" />
              <Text className="text-ink-300 text-xs font-medium">
                {t('outbox.metrics.failed')}
              </Text>
            </View>
            <Text
              style={{ fontVariant: ['tabular-nums'] }}
              className="text-alert-500 text-xl font-bold mt-1"
            >
              {failedCount}
            </Text>
          </View>
        </View>

        {/* Lista de Eventos */}
        <View className="flex-1">
          <OutboxList />
        </View>

        {/* Botão de Reenvio */}
        <View className="mt-2">
          <Button
            label={t('outbox.retry')}
            variant="ghost"
            onPress={() => {
              retryFailed();
              refresh();
            }}
          />
        </View>
      </View>
    </Screen>
  );
}
