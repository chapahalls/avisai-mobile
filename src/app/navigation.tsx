import { View } from 'react-native';
import {
  DarkTheme,
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useSession } from '../features/auth';
import { useOutboxStore } from '../features/outbox';
import { LoginPage } from '../pages/LoginPage';
import { TripPage } from '../pages/TripPage';
import { MapPage } from '../pages/MapPage';
import { DocumentsPage } from '../pages/DocumentsPage';
import { DocumentViewerPage } from '../pages/DocumentViewerPage';
import { OutboxPage } from '../pages/OutboxPage';

export type MainTabParams = {
  Trip: undefined;
  Map: undefined;
  Documents: undefined;
  Outbox: undefined;
};

export type RootStackParams = {
  Login: undefined;
  Main: { screen?: keyof MainTabParams } | undefined;
  DocumentViewer: { id: string };
};

export const navigationRef = createNavigationContainerRef<RootStackParams>();

const Stack = createNativeStackNavigator<RootStackParams>();
const Tabs = createBottomTabNavigator<MainTabParams>();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0B1220',
    card: '#121A2B',
    border: '#2A3550',
    primary: '#099DFD',
    text: '#F4F6FA',
  },
};

function TabIconWrap({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <View
      className={`px-3.5 py-1 rounded-full items-center justify-center ${
        focused ? 'bg-brand-500/15' : 'bg-transparent'
      }`}
    >
      {children}
    </View>
  );
}

function TripTabIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <TabIconWrap focused={focused}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3 17h2m14 0h2M5 17a2 2 0 1 0 4 0m-4 0a2 2 0 1 1 4 0m6 0a2 2 0 1 0 4 0m-4 0a2 2 0 1 1 4 0M9 17h6M3 17V7a1 1 0 0 1 1-1h10v11m0-8h4l3 4v4"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </TabIconWrap>
  );
}

function MapTabIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <TabIconWrap focused={focused}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10Z"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={12} cy={11} r={2.2} stroke={color} strokeWidth={2} />
      </Svg>
    </TabIconWrap>
  );
}

function DocumentsTabIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <TabIconWrap focused={focused}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Rect x={5} y={3} width={14} height={18} rx={2} stroke={color} strokeWidth={2} />
        <Path d="M9 8h6M9 12h6M9 16h4" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </TabIconWrap>
  );
}

function OutboxTabIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <TabIconWrap focused={focused}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3v12m0-12 4 4m-4-4-4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={12} cy={15} r={1} fill={color} />
      </Svg>
    </TabIconWrap>
  );
}

function MainTabs() {
  const { t } = useTranslation();
  const pending = useOutboxStore((s) => s.pending);
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 10);

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#099DFD',
        tabBarInactiveTintColor: '#A7B1C6',
        tabBarStyle: {
          // A altura precisa incluir a barra de navegação do Android. Sem isso,
          // os atalhos e os botões da tela ficam escondidos atrás dela.
          height: 60 + bottomInset,
          paddingTop: 7,
          paddingBottom: bottomInset,
          backgroundColor: '#0E1626',
          borderTopColor: '#1E293B',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="Trip"
        component={TripPage}
        options={{
          title: t('tabs.trip'),
          tabBarIcon: ({ color, focused }) => <TripTabIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Map"
        component={MapPage}
        options={{
          title: t('tabs.map'),
          tabBarIcon: ({ color, focused }) => <MapTabIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Documents"
        component={DocumentsPage}
        options={{
          title: t('tabs.documents'),
          tabBarIcon: ({ color, focused }) => <DocumentsTabIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Outbox"
        component={OutboxPage}
        options={{
          title: t('tabs.outbox'),
          tabBarIcon: ({ color, focused }) => <OutboxTabIcon color={color} focused={focused} />,
          tabBarBadge: pending > 0 ? pending : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#F5A524',
            color: '#0B1220',
            fontSize: 11,
            fontWeight: '700',
          },
        }}
      />
    </Tabs.Navigator>
  );
}

export function AppNavigation() {
  const session = useSession((s) => s.session);
  const { t } = useTranslation();
  return (
    <NavigationContainer ref={navigationRef} theme={theme}>
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
                headerStyle: { backgroundColor: '#0E1626' },
                headerTintColor: '#F4F6FA',
                headerTitleStyle: { fontWeight: '600' },
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginPage} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
