import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DSRadius, DSSpacing, DSType, type DSColorSet } from '@/constants/design-system';
import { useDSColors } from '@/providers/theme-context';

import { AsIcon } from './as-icon';

export type AsChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /** Small colored dot before the label, e.g. to mark a sport/category. */
  dotColor?: string;
};

export function AsChip({ label, active, onPress, dotColor }: AsChipProps) {
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      // Filtro liga/desliga: "checkbox" faz o leitor de tela dizer se está
      // marcado (na web vira role=checkbox + aria-checked; "selected" em botão
      // não é anunciado).
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: !!active }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
      {active ? (
        <AsIcon name="check" size={16} color={colors.primary} />
      ) : (
        dotColor && <View style={[styles.dot, { backgroundColor: dotColor }]} />
      )}
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    chip: {
      height: 36,
      paddingHorizontal: DSSpacing[3],
      borderRadius: DSRadius.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: DSColors.lineStrong,
      backgroundColor: DSColors.surface,
    },
    pressed: {
      backgroundColor: DSColors.surface2,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    chipActive: {
      backgroundColor: DSColors.primaryTint,
      borderColor: DSColors.primary,
    },
    label: {
      ...DSType.label,
      color: DSColors.ink,
    },
    labelActive: {
      color: DSColors.primary,
      fontWeight: '700',
    },
  });
}
