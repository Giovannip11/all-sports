import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DSRadius, DSSpacing, DSType, type DSColorSet } from '@/constants/design-system';
import { useDSColors } from '@/providers/theme-context';

import { AsIcon } from './as-icon';

export type AsCheckboxProps = {
  checked: boolean;
  onToggle: () => void;
  label: string;
};

/** Caixa de seleção com o texto inteiro clicável (alvo ≥ 44pt). */
export function AsCheckbox({ checked, onToggle, label }: AsCheckboxProps) {
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      style={styles.checkRow}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <AsIcon name="check" size={16} color={colors.onPrimary} />}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

export type AsOptionProps = {
  selected: boolean;
  onSelect: () => void;
  label: string;
  help?: string;
};

/** Opção de escolha única em cartão, com explicação (ex.: critério do sorteio). */
export function AsOption({ selected, onSelect, label, help }: AsOptionProps) {
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      accessibilityHint={help}>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{label}</Text>
        {help ? <Text style={styles.optionHelp}>{help}</Text> : null}
      </View>
    </Pressable>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    checkRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: DSSpacing[3],
      paddingVertical: DSSpacing[2],
      minHeight: 44,
    },
    box: {
      width: 24,
      height: 24,
      borderRadius: DSRadius.sm,
      borderWidth: 2,
      borderColor: DSColors.lineStrong,
      backgroundColor: DSColors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boxChecked: {
      backgroundColor: DSColors.primary,
      borderColor: DSColors.primary,
    },
    checkLabel: {
      ...DSType.small,
      flex: 1,
      color: DSColors.inkSecondary,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: DSSpacing[3],
      padding: DSSpacing[3],
      borderRadius: DSRadius.md,
      borderWidth: 1,
      borderColor: DSColors.lineStrong,
      backgroundColor: DSColors.surface,
    },
    optionSelected: {
      borderColor: DSColors.primary,
      backgroundColor: DSColors.primaryTint,
    },
    radio: {
      width: 22,
      height: 22,
      marginTop: 1,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: DSColors.lineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: {
      borderColor: DSColors.primary,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: DSColors.primary,
    },
    optionText: {
      flex: 1,
      gap: 2,
    },
    optionLabel: {
      ...DSType.labelStrong,
      color: DSColors.ink,
    },
    optionHelp: {
      ...DSType.meta,
      color: DSColors.inkSecondary,
    },
  });
}
