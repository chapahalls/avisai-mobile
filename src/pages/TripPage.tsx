import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { DemoControls, RouteMap, StayCounter, TripStatusCard, useTrip } from '../features/trip';
import { MicButton, QuickUtterances, Transcript, VoiceStateIndicator } from '../features/voice';

/** Tela principal: mapa, status, contador de espera e a conversa com o agente. */
export function TripPage() {
  const { t } = useTranslation();
  const { phase, start, reset } = useTrip();
  return (
    <Screen>
      <RouteMap />
      {phase === 'idle' ? (
        <Button label={t('trip.start')} onPress={start} />
      ) : (
        <>
          <TripStatusCard />
          <StayCounter />
          <Card>
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-ink-50 font-semibold">{t('voice.title')}</Text>
              <VoiceStateIndicator />
            </View>
            <Transcript />
            <View className="items-center mt-2">
              <MicButton />
            </View>
            <QuickUtterances />
          </Card>
          {phase === 'unloaded' && <Button label={t('trip.restart')} variant="ghost" onPress={reset} />}
        </>
      )}
      <DemoControls />
    </Screen>
  );
}
