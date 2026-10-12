import { Pressable, StyleSheet, Text } from 'react-native';

import { DSColors, DSText } from '@/constants/design-system';

export type AsChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
};

export function AsChip({ label, active, onPress }: AsChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DSColors.line,
    backgroundColor: DSColors.surface,
  },
  chipActive: {
    backgroundColor: DSColors.primaryTint,
    borderColor: DSColors.primary,
    borderWidth: 1.5,
  },
  label: {
    fontSize: DSText.sm,
    fontWeight: '800',
    color: DSColors.ink,
  },
  labelActive: {
    color: DSColors.primary,
  },
});
