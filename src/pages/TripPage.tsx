import { useState } from 'react';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainTabParams, RootStackParams } from '../app/navigation';
import { Screen } from '../components/Screen';
import { JourneyTimeline, StayCounter } from '../features/trip';
import { useCompactLayout } from '../utils/layout';
import { HomeHeader } from './home/HomeHeader';
import { CentralRequestCard, HomeNotices, HomeShortcuts, QuickActions, RestartTrip } from './home/HomeSections';
import { TripCard } from './home/TripCard';
import { SettingsSheet } from './SettingsSheet';

type HomeNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParams, 'Trip'>,
  NativeStackNavigationProp<RootStackParams>
>;

/**
 * Início (mockup `03-home`): saudação, viagem, atalhos, recado do CCO, espera e jornada.
 * Cada parte assina só o pedaço da viagem que mostra (`pages/home/`): o simulador grava
 * relógio e posição a cada 500 ms e a tela inteira não precisa redesenhar junto.
 */
export function TripPage() {
  const nav = useNavigation<HomeNav>();
  const compact = useCompactLayout();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <Screen>
      <HomeHeader onOpenSettings={() => setSettingsOpen(true)} />
      <HomeNotices />
      <TripCard compact={compact} />
      <HomeShortcuts
        compact={compact}
        onMessages={() => nav.navigate('Messages')}
        onQueue={() => nav.navigate('Queue')}
        onMap={() => nav.navigate('Map')}
      />
      <CentralRequestCard />
      <StayCounter />
      <QuickActions />
      <JourneyTimeline />
      <RestartTrip />
      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Screen>
  );
}
