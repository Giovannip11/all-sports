import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DSRadius, DSSpacing, DSType, type DSColorSet } from '@/constants/design-system';
import { useDSColors } from '@/providers/theme-context';

import { AsButton } from './as-button';

export type AsConfirmProps = {
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  /** Ação destrutiva (vermelho) ou só uma mudança importante (verde). */
  destructive?: boolean;
};

/** Confirmação inline — substitui o botão de ação até a pessoa decidir. */
export function AsConfirm({
  message,
  confirmLabel,
  cancelLabel = 'Voltar',
  onConfirm,
  onCancel,
  loading,
  destructive,
}: AsConfirmProps) {
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      style={[styles.box, destructive && styles.boxDanger]}
      accessibilityLiveRegion="polite">
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        <AsButton
          label={cancelLabel}
          variant="secondary"
          style={styles.button}
          disabled={loading}
          onPress={onCancel}
        />
        <AsButton
          label={confirmLabel}
          variant={destructive ? 'danger' : 'primary'}
          style={styles.button}
          loading={loading}
          onPress={onConfirm}
        />
      </View>
    </View>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    box: {
      gap: DSSpacing[3],
      padding: DSSpacing[4],
      borderRadius: DSRadius.md,
      borderWidth: 1,
      borderColor: DSColors.lineStrong,
      backgroundColor: DSColors.surface,
    },
    boxDanger: {
      borderColor: DSColors.danger,
      backgroundColor: DSColors.dangerTint,
    },
    message: {
      ...DSType.small,
      color: DSColors.ink,
    },
    actions: {
      flexDirection: 'row',
      gap: DSSpacing[2],
    },
    button: {
      flex: 1,
    },
  });
}
