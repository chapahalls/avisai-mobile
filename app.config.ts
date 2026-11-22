import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY_ANDROID?.trim() ?? '';
  const hasGoogleMapsKey = Boolean(googleMapsApiKey);

  return {
    ...config,
    name: 'AvisAI',
    slug: 'avisai-mobile',
    scheme: 'avisai',
    version: '0.1.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    backgroundColor: '#0B1220',
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
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            minSdkVersion: 24,
          },
        },
      ],
    ],
  };
};
