import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { DSLayout } from '@/constants/design-system';

export type AsColumnProps = {
  children: ReactNode;
  /** `form` = coluna mais estreita para formulários. */
  width?: 'content' | 'form';
  style?: StyleProp<ViewStyle>;
};

/**
 * Coluna centralizada com largura máxima — no celular ocupa tudo; na web e em
 * tablets evita formulários e listas esticados na tela inteira.
 */
export function AsColumn({ children, width = 'content', style }: AsColumnProps) {
  return (
    <View style={[styles.column, width === 'form' && styles.form, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: DSLayout.maxContent,
    alignSelf: 'center',
  },
  form: {
    maxWidth: DSLayout.maxForm,
  },
});
