import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  size?: 'md' | 'sm';
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  className = '',
}: Props) {
  const sizeStyles = size === 'sm' ? 'px-3.5 py-2 rounded-xl' : 'px-5 py-3.5 rounded-xl';
  const variantStyles =
    variant === 'primary'
      ? 'bg-brand-500 border border-brand-500'
      : 'bg-ink-900/90 border border-ink-700';

  const shadowStyle =
    variant === 'primary' && !disabled
      ? {
          shadowColor: '#099DFD',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 4,
        }
      : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={shadowStyle}
      className={`flex-row items-center justify-center gap-2 active:opacity-80 ${sizeStyles} ${variantStyles} ${
        disabled ? 'opacity-50' : ''
      } ${className}`}
      accessibilityRole="button"
    >
      {icon ? <View>{icon}</View> : null}
      <Text
        className={`font-semibold tracking-tight ${
          size === 'sm' ? 'text-xs' : 'text-base'
        } ${variant === 'primary' ? 'text-ink-50' : 'text-ink-50'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
