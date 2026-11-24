import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY_ANDROID?.trim() ?? '';
  const hasGoogleMapsKey = Boolean(googleMapsApiKey);
  // A URL do backend também pode ser alterada em tempo de execução no painel Demo.
  // Portanto, o binário deve aceitar HTTP mesmo se o build atual usar HTTPS; sem
  // isso, Android bloqueia uma URL LAN configurada depois e o fetch vira
  // apenas "Network request failed".
  const allowCleartextTraffic = true;

  return {
    ...config,
    name: 'RODAR',
    slug: 'avisai-mobile',
    icon: './assets/app-icon.png',
    scheme: 'avisai',
    version: '0.1.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    backgroundColor: '#090B09', // ink-950 (src/lib/theme.ts)
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.chapahalls.avisai',
    },
    android: {
      package: 'com.chapahalls.avisai',
      permissions: [
        'RECORD_AUDIO',
        'MODIFY_AUDIO_SETTINGS',
        'BLUETOOTH_CONNECT',
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'INTERNET',
        'ACCESS_NETWORK_STATE',
      ],
      ...(hasGoogleMapsKey
        ? {
            config: {
              googleMaps: {
                apiKey: googleMapsApiKey,
              },
            },
          }
        : {}),
    },
    extra: {
      hasGoogleMapsKey,
    },
    plugins: [
      'expo-dev-client',
      'expo-sqlite',
      'expo-localization',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'O RODAR usa sua localização para acompanhar a rota ativa e avisar sobre chegada.',
          locationAlwaysAndWhenInUsePermission:
            'O RODAR usa sua localização em segundo plano durante a viagem ativa para atualizar a rota.',
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            minSdkVersion: 24,
            usesCleartextTraffic: allowCleartextTraffic,
          },
        },
      ],
    ],
  };
};
