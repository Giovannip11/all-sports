import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import {
  DSLayout,
  DSRadius,
  DSSpacing,
  DSText,
  DSType,
  type DSColorSet,
} from '@/constants/design-system';
import { useDSColors } from '@/providers/theme-context';

import { AsIcon, type IconName } from './as-icon';

/** dangerGhost = ação destrutiva secundária (texto vermelho, sem fundo). */
export type AsButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerGhost';
export type AsButtonSize = 'md' | 'sm';

export type AsButtonProps = PressableProps & {
  label: string;
  variant?: AsButtonVariant;
  size?: AsButtonSize;
  icon?: IconName;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
};

export function AsButton({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  block,
  disabled,
  loading,
  style,
  ...rest
}: AsButtonProps) {
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDisabled = disabled || loading;

  const fg =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'danger'
        ? colors.onDanger
        : variant === 'ghost'
          ? colors.primary
          : variant === 'dangerGhost'
            ? colors.danger
            : colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={size === 'sm' ? 4 : undefined}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.sm,
        styles[variant],
        block && styles.block,
        isDisabled && styles.disabled,
        pressed && !isDisabled && pressedStyle(styles, variant),
        typeof style === 'function' ? undefined : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        icon && <AsIcon name={icon} size={size === 'sm' ? 18 : 20} color={fg} />
      )}
      <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function pressedStyle(styles: ReturnType<typeof createStyles>, variant: AsButtonVariant) {
  switch (variant) {
    case 'primary':
      return styles.primaryPressed;
    case 'danger':
      return styles.dangerPressed;
    default:
      return styles.neutralPressed;
  }
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    base: {
      minHeight: DSLayout.control,
      paddingHorizontal: DSSpacing[5],
      borderRadius: DSRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: DSSpacing[2],
    },
    sm: {
      minHeight: 40,
      paddingHorizontal: DSSpacing[4],
    },
    block: {
      alignSelf: 'stretch',
    },
    primary: {
      backgroundColor: DSColors.primary,
    },
    primaryPressed: {
      backgroundColor: DSColors.primaryPressed,
    },
    secondary: {
      backgroundColor: DSColors.surface,
      borderWidth: 1,
      borderColor: DSColors.lineStrong,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
    danger: {
      backgroundColor: DSColors.danger,
    },
    dangerGhost: {
      backgroundColor: 'transparent',
    },
    dangerPressed: {
      backgroundColor: DSColors.dangerPressed,
    },
    neutralPressed: {
      backgroundColor: DSColors.surface2,
    },
    disabled: {
      opacity: 0.45,
    },
    label: {
      ...DSType.bodyStrong,
    },
    labelSm: {
      fontSize: DSText.sm,
      lineHeight: 18,
    },
  });
}
