import { Text, type TextProps } from 'react-native';

import { DSType, type DSColorSet, type DSTypeVariant } from '@/constants/design-system';
import { useDSColors } from '@/providers/theme-context';

type Tone = 'ink' | 'secondary' | 'tertiary' | 'primary' | 'danger' | 'inverse' | 'onPrimary';

export type AsTextProps = TextProps & {
  variant?: DSTypeVariant;
  tone?: Tone;
  align?: 'left' | 'center' | 'right';
};

function toneColor(colors: DSColorSet, tone: Tone) {
  switch (tone) {
    case 'secondary':
      return colors.inkSecondary;
    case 'tertiary':
      return colors.inkTertiary;
    case 'primary':
      return colors.primary;
    case 'danger':
      return colors.danger;
    case 'inverse':
      return colors.inverse;
    case 'onPrimary':
      return colors.onPrimary;
    default:
      return colors.ink;
  }
}

/** Texto do design system: variante tipográfica + tom de cor do tema. */
export function AsText({ variant = 'body', tone = 'ink', align, style, ...rest }: AsTextProps) {
  const colors = useDSColors();
  return (
    <Text
      style={[DSType[variant], { color: toneColor(colors, tone) }, align && { textAlign: align }, style]}
      {...rest}
    />
  );
}
