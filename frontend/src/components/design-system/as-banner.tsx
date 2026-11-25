import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { DSRadius, DSSpacing, DSType } from '@/constants/design-system';
import { useDSColors } from '@/providers/theme-context';

import { AsIcon, type IconName } from './as-icon';

export type AsBannerTone = 'error' | 'success' | 'info' | 'warning';

export type AsBannerProps = {
  tone?: AsBannerTone;
  message: string;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
};

const ICON: Record<AsBannerTone, IconName> = {
  error: 'alert',
  success: 'check',
  info: 'alert',
  warning: 'alert',
};

/** Mensagem de status inline (erro, sucesso, aviso), anunciada ao leitor de tela. */
export function AsBanner({ tone = 'error', message, action, style }: AsBannerProps) {
  const colors = useDSColors();
  const palette = {
    error: { bg: colors.dangerTint, fg: colors.danger },
    success: { bg: colors.primaryTint, fg: colors.primary },
    info: { bg: colors.surface2, fg: colors.ink },
    warning: { bg: colors.warningTint, fg: colors.warning },
  }[tone];

  return (
    <View
      style={[styles.banner, { backgroundColor: palette.bg }, style]}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite">
      <AsIcon name={ICON[tone]} size={20} color={palette.fg} />
      <Text style={[styles.message, { color: palette.fg }]}>{message}</Text>
      {action && (
        <Pressable
          onPress={action.onPress}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={action.label}>
          <Text style={[styles.action, { color: palette.fg }]}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DSSpacing[2],
    paddingVertical: DSSpacing[3],
    paddingHorizontal: DSSpacing[3],
    borderRadius: DSRadius.md,
  },
  message: {
    ...DSType.label,
    flex: 1,
  },
  action: {
    ...DSType.labelStrong,
    textDecorationLine: 'underline',
  },
});
