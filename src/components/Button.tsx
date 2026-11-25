import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

/**
 * Botões dos mockups RODAR-telas: cantos bem arredondados, altura generosa para uso
 * com o caminhão parado e luvas. `primary` verde, `outline` contorno, `wait` âmbar
 * (ação pendente que trava a viagem), `light` claro (mostrar documento à fiscalização).
 * `ghost` é o nome antigo de `outline` e continua aceito.
 */
type Variant = 'primary' | 'outline' | 'ghost' | 'wait' | 'light';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
  accessibilityHint?: string;
}

const containerByVariant: Record<Variant, string> = {
  primary: 'bg-brand-500',
  outline: 'bg-transparent border border-ink-700',
  ghost: 'bg-transparent border border-ink-700',
  wait: 'bg-wait-500',
  light: 'bg-ink-50',
};

const textByVariant: Record<Variant, string> = {
  primary: 'text-ink-50',
  outline: 'text-ink-50',
  ghost: 'text-ink-50',
  wait: 'text-ink-950',
  light: 'text-ink-950',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  className = '',
  accessibilityHint,
}: Props) {
  const sizeStyles = size === 'sm' ? 'px-4 py-2.5 rounded-xl' : 'px-5 py-4 rounded-2xl';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center justify-center gap-2.5 active:opacity-80 ${sizeStyles} ${
        containerByVariant[variant]
      } ${disabled ? 'opacity-50' : ''} ${className}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityHint={accessibilityHint}
    >
      {icon ? <View>{icon}</View> : null}
      <Text
        className={`font-bold tracking-tight ${size === 'sm' ? 'text-sm' : 'text-lg'} ${
          textByVariant[variant]
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
