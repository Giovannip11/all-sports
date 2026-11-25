import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DSRadius, DSType, type DSColorSet } from '@/constants/design-system';
import { useDSColors } from '@/providers/theme-context';

export type AsSegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Rótulo falado, quando o visível é curto demais. */
  accessibilityLabel?: string;
};

export type AsSegmentedProps<T extends string> = {
  options: AsSegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Escolha única entre 2–4 opções curtas (papel, visibilidade, tema). */
export function AsSegmented<T extends string>({ options, value, onChange }: AsSegmentedProps<T>) {
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.segment} accessibilityRole="radiogroup">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.button, active && styles.buttonActive]}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, checked: active }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}>
            {/* Até 2 linhas: em tela estreita o rótulo quebra em vez de virar "Interm…". */}
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    segment: {
      flexDirection: 'row',
      gap: 4,
      padding: 4,
      backgroundColor: DSColors.surface2,
      borderRadius: DSRadius.md,
    },
    button: {
      flex: 1,
      minHeight: 40,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: DSRadius.sm,
    },
    buttonActive: {
      backgroundColor: DSColors.surface,
      borderWidth: 1,
      borderColor: DSColors.lineStrong,
    },
    label: {
      ...DSType.label,
      color: DSColors.inkSecondary,
      textAlign: 'center',
    },
    labelActive: {
      color: DSColors.ink,
      fontWeight: '700',
    },
  });
}
