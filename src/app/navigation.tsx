import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useSession } from '../features/auth';
import { LoginPage } from '../pages/LoginPage';
import { TripPage } from '../pages/TripPage';
import { DocumentsPage } from '../pages/DocumentsPage';
import { DocumentViewerPage } from '../pages/DocumentViewerPage';
import { OutboxPage } from '../pages/OutboxPage';

export type RootStackParams = {
  Login: undefined;
  Main: undefined;
  DocumentViewer: { id: string };
};

const Stack = createNativeStackNavigator<RootStackParams>();
const Tabs = createBottomTabNavigator();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: '#0B1220', card: '#121A2B', border: '#2A3550', primary: '#099DFD', text: '#F4F6FA' },
};

function MainTabs() {
  const { t } = useTranslation();
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: '#099DFD', tabBarInactiveTintColor: '#A7B1C6' }}>
      <Tabs.Screen name="Trip" component={TripPage} options={{ title: t('tabs.trip') }} />
      <Tabs.Screen name="Documents" component={DocumentsPage} options={{ title: t('tabs.documents') }} />
      <Tabs.Screen name="Outbox" component={OutboxPage} options={{ title: t('tabs.outbox') }} />
    </Tabs.Navigator>
  );
}

export function AppNavigation() {
  const session = useSession((s) => s.session);
  const { t } = useTranslation();
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="DocumentViewer" component={DocumentViewerPage} options={{ headerShown: true, title: t('documents.viewer') }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginPage} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
