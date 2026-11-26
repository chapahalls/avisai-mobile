// Usado só pelo build web de captura (scripts/readme-captures). Não é a config do app.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Módulos nativos sem versão web: viram objetos vazios. O app já trata a ausência
// deles (cai para voz Mock e mapa SVG), como no Expo Go.
const NATIVE_ONLY = [
  'react-native-maps',
  'react-native-agora',
  'react-native-fs',
  '@fugood/react-native-audio-pcm-stream',
  'expo-speech-recognition',
  'expo-task-manager',
];

const original = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, name, platform) => {
  if (platform === 'web') {
    if (name === 'expo-sqlite') {
      return { type: 'sourceFile', filePath: path.join(__dirname, 'capture-stubs/sqlite.js') };
    }
    if (NATIVE_ONLY.some((m) => name === m || name.startsWith(`${m}/`))) {
      return { type: 'sourceFile', filePath: path.join(__dirname, 'capture-stubs/empty.js') };
    }
  }
  return original ? original(context, name, platform) : context.resolveRequest(context, name, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
