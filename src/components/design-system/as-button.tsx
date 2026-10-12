import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { DSColors, DSRadius, DSText } from '@/constants/design-system';

export type AsButtonVariant = 'primary' | 'secondary' | 'ghost';

export type AsButtonProps = PressableProps & {
  label: string;
  variant?: AsButtonVariant;
  block?: boolean;
  disabled?: boolean;
};

export function AsButton({
  label,
  variant = 'primary',
  block,
  disabled,
  style,
  ...rest
}: AsButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        block && styles.block,
        disabled && styles.disabled,
        pressed && !disabled && variant === 'primary' && styles.primaryPressed,
        pressed && !disabled && variant !== 'primary' && styles.pressed,
        typeof style === 'function' ? undefined : style,
      ]}
      {...rest}>
      <Text
        style={[
          styles.label,
          variant === 'primary' && styles.labelPrimary,
          variant === 'secondary' && styles.labelSecondary,
          variant === 'ghost' && styles.labelGhost,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: DSRadius.lg + 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: {
    alignSelf: 'stretch',
  },
  primary: {
    backgroundColor: DSColors.accent,
  },
  primaryPressed: {
    backgroundColor: DSColors.accentPressed,
  },
  secondary: {
    backgroundColor: DSColors.surface,
    borderWidth: 1,
    borderColor: DSColors.lineStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: DSText.md,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  labelPrimary: {
    color: DSColors.inverse,
  },
  labelSecondary: {
    color: DSColors.ink,
  },
  labelGhost: {
    color: DSColors.primary,
  },
});
