import '../../global.css';
import '../lib/i18n';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigation } from './navigation';
import { bootstrap } from './bootstrap';

export default function App() {
  useEffect(() => bootstrap(), []);
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppNavigation />
    </SafeAreaProvider>
  );
}
