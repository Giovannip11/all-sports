import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DSColors, DSText } from '@/constants/design-system';

export type AsChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /** Small colored dot before the label, e.g. to mark a sport/category. */
  dotColor?: string;
};

export function AsChip({ label, active, onPress, dotColor }: AsChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[styles.chip, active && styles.chipActive]}>
      {dotColor && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: DSColors.line,
    backgroundColor: DSColors.surface,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
