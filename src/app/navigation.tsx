import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  DarkTheme,
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components/Icon';
import { useSession } from '../features/auth';
import { useOutboxStore } from '../features/outbox';
import { useDrivingMode, useStaySummary, useTrip } from '../features/trip';
import { AvisaiDock } from '../features/voice';
import { LAYOUT } from '../lib/config';
import { colors } from '../lib/theme';
import { useBottomInset } from '../utils/layout';
import { LoginPage } from '../pages/LoginPage';
import { TripPage } from '../pages/TripPage';
import { MapPage } from '../pages/MapPage';
import { DocumentsPage } from '../pages/DocumentsPage';
import { DocumentViewerPage } from '../pages/DocumentViewerPage';
import { MessagesPage } from '../pages/MessagesPage';
import { QueuePage } from '../pages/QueuePage';
import { DrivingLock } from './DrivingLock';

export type MainTabParams = {
  Trip: undefined;
  Map: undefined;
  Documents: undefined;
  Messages: undefined;
};

export type RootStackParams = {
  Login: undefined;
  Main: { screen?: keyof MainTabParams } | undefined;
  DocumentViewer: { id: string };
  Queue: undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParams>();

const Stack = createNativeStackNavigator<RootStackParams>();
const Tabs = createBottomTabNavigator<MainTabParams>();

/** Altura útil da barra de abas, sem a área segura do sistema. */
const TAB_BAR_HEIGHT = 68;

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.ink[950],
    card: colors.ink[950],
    border: colors.ink[800],
    primary: colors.brand[300],
    text: colors.ink[50],
  },
};

function TabIcon({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
  // Além da cor, a aba ativa ganha um fundo: a cor não comunica sozinha.
  return (
    <View
      className={`px-4 py-1 rounded-full items-center justify-center ${
        focused ? 'bg-brand-500/20' : 'bg-transparent'
      }`}
    >
      <Icon name={name} size={24} color={color} />
    </View>
  );
}


function MainTabs() {
  const { t } = useTranslation();
  const pending = useOutboxStore((s) => s.pending);
  const bottomInset = useBottomInset();

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand[300],
        tabBarInactiveTintColor: colors.ink[300],
        tabBarStyle: {
          // A altura precisa incluir a barra de navegação do Android. Sem isso,
          // os atalhos e os botões da tela ficam escondidos atrás dela.
          height: TAB_BAR_HEIGHT + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
          backgroundColor: colors.ink[950],
          borderTopColor: colors.ink[800],
          borderTopWidth: 1,
        },
        // Rótulo próprio: com fonte grande, "Documentos" era cortado ("Document…").
        tabBarLabel: ({ color, children }) => (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={LAYOUT.tabLabelMaxScale}
            style={{ color, fontSize: 12, fontWeight: '600', marginTop: 4 }}
          >
            {children}
          </Text>
        ),
      }}
    >
      <Tabs.Screen
        name="Trip"
        component={TripPage}
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Map"
        component={MapPage}
        options={{
          title: t('tabs.map'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="map" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Documents"
        component={DocumentsPage}
        options={{
          title: t('tabs.documents'),
          tabBarIcon: ({ color, focused }) => <TabIcon name="file" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Messages"
        component={MessagesPage}
        options={{
          title: t('tabs.messages'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="message" color={color} focused={focused} />
          ),
          tabBarBadge: pending > 0 ? pending : undefined,
          tabBarAccessibilityLabel:
            pending > 0 ? t('tabs.messagesPending', { count: pending }) : t('tabs.messages'),
          tabBarBadgeStyle: {
            backgroundColor: colors.wait[500],
            color: colors.ink[950],
            fontSize: 11,
            fontWeight: '700',
          },
        }}
      />
    </Tabs.Navigator>
  );
}

/**
 * AvisAI flutuante sobre o app logado, em qualquer tela: a esfera fica onde o motorista a deixou.
 * No modo direção ela some: a tela de direção já é a conversa por voz.
 */
function DockLayer({ tab }: { tab: string | null }) {
  const { t } = useTranslation();
  const bottomInset = useBottomInset();
  const insets = useSafeAreaInsets();
  const stay = useStaySummary();
  const phase = useTrip((s) => s.phase);
  const speedKmh = useTrip((s) => s.speedKmh);
  const driving = useDrivingMode((s) => s.driving);
  const moving = phase === 'driving' || phase === 'approaching';
  const contextPill = moving
    ? speedKmh !== null
      ? t('home.tripModeSpeed', { kmh: Math.round(speedKmh) })
      : t('home.tripMode')
    : null;

  return (
    <AvisaiDock
      showOrb={!driving}
      safeTop={insets.top}
      safeBottom={insets.bottom}
      // Posição inicial (antes de o motorista arrastar): em Mensagens sobe acima da linha de escrever.
      bottomOffset={TAB_BAR_HEIGHT + bottomInset + 12 + (tab === 'Messages' ? LAYOUT.messagesComposerDp : 0)}
      stayTimer={stay.timer}
      stayValue={stay.value}
      stayOver={stay.over}
      contextPill={contextPill}
    />
  );
}

export function AppNavigation() {
  const session = useSession((s) => s.session);
  const { t } = useTranslation();
  const [tab, setTab] = useState<string | null>(null);

  const syncRoute = () => {
    const root = navigationRef.getRootState();
    const top = root?.routes[root.index];
    const tabs = top?.state;
    setTab(tabs && typeof tabs.index === 'number' ? (tabs.routes[tabs.index]?.name ?? null) : null);
  };

  return (
    <View className="flex-1 bg-ink-950">
      <NavigationContainer ref={navigationRef} theme={theme} onReady={syncRoute} onStateChange={syncRoute}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {session ? (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen
                name="DocumentViewer"
                component={DocumentViewerPage}
                options={{
                  headerShown: true,
                  title: t('documents.viewer'),
                  headerStyle: { backgroundColor: colors.ink[950] },
                  headerTintColor: colors.ink[50],
                  headerTitleStyle: { fontWeight: '600' },
                  headerShadowVisible: false,
                }}
              />
              <Stack.Screen name="Queue" component={QueuePage} />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginPage} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
      {session ? <DockLayer tab={tab} /> : null}
      {session ? <DrivingLock /> : null}
    </View>
  );
}
