import { Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useVoice } from '../hooks/useVoice';

/** Toque com o agente falando = barge-in (interrompe na hora). */
export function MicButton() {
  const { t } = useTranslation();
  const { state, listen } = useVoice();
  const active = state === 'listening';
  const label = state === 'speaking' ? t('voice.interrupt') : active ? t('voice.listening') : t('voice.talk');
  return (
    <Pressable
      onPress={listen}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`w-20 h-20 rounded-full items-center justify-center ${active ? 'bg-brand-500' : 'bg-ink-800 border-2 border-brand-500'}`}
    >
      <Text className="text-ink-50 text-xs font-semibold text-center px-1">{label}</Text>
    </Pressable>
  );
}
