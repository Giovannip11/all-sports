import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { DSLayout, DSRadius, DSType, type DSColorSet } from '@/constants/design-system';
import { useDSColors } from '@/providers/theme-context';

import { AsIcon, type IconName } from './as-icon';

export type AsIconButtonProps = {
  icon: IconName;
  /** Nome falado pelo leitor de tela — obrigatório, o botão não tem texto. */
  label: string;
  onPress?: () => void;
  variant?: 'plain' | 'tonal' | 'primary';
  /** Contador sobre o ícone (ex.: notificações não lidas). */
  badge?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AsIconButton({
  icon,
  label,
  onPress,
  variant = 'plain',
  badge,
  disabled,
  style,
}: AsIconButtonProps) {
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fg = variant === 'primary' ? colors.onPrimary : colors.ink;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} não lidas` : label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        variant === 'tonal' && styles.tonal,
        variant === 'primary' && styles.primary,
        pressed && (variant === 'primary' ? styles.primaryPressed : styles.pressed),
        disabled && styles.disabled,
        style,
      ]}>
      <AsIcon name={icon} size={22} color={fg} />
      {!!badge && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    base: {
      width: DSLayout.touch,
      height: DSLayout.touch,
      borderRadius: DSRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tonal: {
      backgroundColor: DSColors.surface2,
    },
    primary: {
      backgroundColor: DSColors.primary,
    },
    primaryPressed: {
      backgroundColor: DSColors.primaryPressed,
    },
    pressed: {
      backgroundColor: DSColors.line,
    },
    disabled: {
      opacity: 0.45,
    },
    badge: {
      position: 'absolute',
      top: 4,
      right: 4,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: DSRadius.pill,
      backgroundColor: DSColors.danger,
      borderWidth: 2,
      borderColor: DSColors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      ...DSType.meta,
      fontSize: 10,
      lineHeight: 12,
      fontWeight: '700',
      color: DSColors.onDanger,
    },
  });
}
