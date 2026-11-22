import { Pressable, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNetwork, type NetworkQuality } from '../../../services/network';
import { useTrip } from '../hooks/useTrip';

/** Controles da demo: simular rede, decidir se o CCO responde e avançar o relógio. */
export function DemoControls() {
  const { t } = useTranslation();
  const { override, setOverride } = useNetwork();
  const { ccoWillRespond, setCcoWillRespond, skip } = useTrip();
  const options: (NetworkQuality | null)[] = [null, 'weak', 'offline'];
  return (
    <View className="bg-ink-900 border border-dashed border-ink-700 rounded-card p-3">
      <Text className="text-ink-300 text-xs mb-2">{t('demo.title')}</Text>
      <View className="flex-row gap-2 mb-2">
        {options.map((o) => (
          <Pressable key={String(o)} onPress={() => setOverride(o)} className={`px-3 py-1 rounded-full border ${override === o ? 'bg-brand-500 border-brand-500' : 'border-ink-700'}`}>
            <Text className="text-ink-50 text-xs">{t(`demo.net.${o ?? 'real'}`)}</Text>
          </Pressable>
        ))}
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-ink-50 text-xs">{t('demo.ccoResponds')}</Text>
        <Switch value={ccoWillRespond} onValueChange={setCcoWillRespond} />
      </View>
      <Pressable onPress={() => skip(60)} className="mt-2 self-start px-3 py-1 rounded-full border border-ink-700">
        <Text className="text-ink-50 text-xs">{t('demo.skipHour')}</Text>
      </Pressable>
    </View>
  );
}
