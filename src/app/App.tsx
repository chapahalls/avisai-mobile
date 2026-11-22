import '../../global.css';
import '../lib/i18n';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigation } from './navigation';
import { bootstrap } from './bootstrap';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const cleanup = bootstrap();
    setReady(true);
    return cleanup;
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {ready ? <AppNavigation /> : <View className="flex-1 bg-ink-950" />}
    </SafeAreaProvider>
  );
}
