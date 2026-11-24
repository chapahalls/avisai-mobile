import '../../global.css';
import '../lib/i18n';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { KumbhSans_700Bold } from '@expo-google-fonts/kumbh-sans/700Bold';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
// Importa só o peso usado: o índice do pacote embutiria todas as variações no app.
import { SPLASH_MS, SplashScreen } from '../components/SplashScreen';
import { AppNavigation } from './navigation';
import { bootstrap } from './bootstrap';

export default function App() {
  const [ready, setReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  // Fontes da assinatura RODAR e dos títulos, empacotadas no app (sem requisição externa).
  // Se falhar, o app segue com a fonte do sistema.
  const [fontsLoaded, fontError] = useFonts({ KumbhSans_700Bold, SpaceGrotesk_700Bold });

  useEffect(() => {
    const cleanup = bootstrap();
    setReady(true);
    const timer = setTimeout(() => setSplashDone(true), SPLASH_MS);
    return () => {
      clearTimeout(timer);
      cleanup?.();
    };
  }, []);

  const fontsSettled = fontsLoaded || Boolean(fontError);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {ready && fontsSettled && splashDone ? (
        <AppNavigation />
      ) : (
        <SplashScreen fontsReady={fontsLoaded} />
      )}
    </SafeAreaProvider>
  );
}
