import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { DSRadius, DSType } from '@/constants/design-system';
import { useDSColors } from '@/providers/theme-context';

export type AsBadgeTone = 'neutral' | 'primary' | 'accent' | 'danger' | 'warning' | 'ink';

export type AsBadgeProps = {
  label: string;
  tone?: AsBadgeTone;
  style?: StyleProp<ViewStyle>;
};

/** Selo curto de estado: Privado, Lotado, Você organiza, Plano atual. */
export function AsBadge({ label, tone = 'neutral', style }: AsBadgeProps) {
  const colors = useDSColors();
  const palette = {
    neutral: { bg: colors.surface2, fg: colors.ink },
    primary: { bg: colors.primaryTint, fg: colors.primary },
    accent: { bg: colors.accent, fg: colors.onAccent },
    danger: { bg: colors.dangerTint, fg: colors.danger },
    warning: { bg: colors.warningTint, fg: colors.warning },
    ink: { bg: colors.ink, fg: colors.surface },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }, style]}>
      <Text style={[styles.label, { color: palette.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: DSRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...DSType.meta,
    fontWeight: '700',
  },
});
