import { Pressable, Text } from 'react-native';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
}

export function Button({ label, onPress, variant = 'primary', disabled }: Props) {
  const base = 'rounded-input px-5 py-3 items-center';
  const style = variant === 'primary' ? 'bg-brand-500' : 'border border-ink-700';
  return (
    <Pressable onPress={onPress} disabled={disabled} className={`${base} ${style} ${disabled ? 'opacity-50' : ''}`} accessibilityRole="button">
      <Text className="text-ink-50 font-semibold">{label}</Text>
    </Pressable>
  );
}
