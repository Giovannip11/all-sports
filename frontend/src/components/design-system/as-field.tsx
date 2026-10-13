import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { DSColors, DSRadius, DSText } from '@/constants/design-system';

export type AsFieldProps = TextInputProps & {
  label: string;
  /** Renders a text link on the label row, e.g. "Esqueci" */
  labelAction?: { label: string; onPress: () => void };
  /** Toggles a visible/hidden password control instead of rendering secureTextEntry directly */
  isPassword?: boolean;
  helpText?: string;
  error?: string;
};

export function AsField({
  label,
  labelAction,
  isPassword,
  helpText,
  error,
  style,
  ...rest
}: AsFieldProps) {
  const [hidden, setHidden] = useState(isPassword);

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelAction && (
          <Pressable onPress={labelAction.onPress} hitSlop={8}>
            <Text style={styles.labelAction}>{labelAction.label}</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.control}>
        <TextInput
          style={[
            styles.input,
            isPassword && styles.inputWithAccessory,
            error && styles.inputError,
            style,
          ]}
          placeholderTextColor={DSColors.inkTertiary}
          secureTextEntry={isPassword ? hidden : undefined}
          {...rest}
        />
        {isPassword && (
          <Pressable
            onPress={() => setHidden((v) => !v)}
            hitSlop={8}
            style={styles.accessory}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar senha' : 'Ocultar senha'}>
            <Text style={styles.accessoryLabel}>{hidden ? 'Mostrar' : 'Ocultar'}</Text>
          </Pressable>
        )}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        helpText && <Text style={styles.help}>{helpText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    fontSize: DSText.sm,
    fontWeight: '800',
    color: DSColors.ink,
  },
  labelAction: {
    fontSize: DSText.sm,
    fontWeight: '800',
    color: DSColors.primary,
  },
  control: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: DSRadius.md,
    borderWidth: 1,
    borderColor: DSColors.lineStrong,
    backgroundColor: DSColors.surface,
    color: DSColors.ink,
    fontSize: DSText.md,
    fontWeight: '600',
  },
  inputWithAccessory: {
    paddingRight: 76,
  },
  inputError: {
    borderColor: DSColors.danger,
  },
  accessory: {
    position: 'absolute',
    right: 10,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  accessoryLabel: {
    fontSize: DSText.xs,
    fontWeight: '800',
    color: DSColors.inkSecondary,
  },
  help: {
    fontSize: DSText.xs,
    fontWeight: '600',
    color: DSColors.inkSecondary,
  },
  error: {
    fontSize: DSText.xs,
    fontWeight: '700',
    color: DSColors.danger,
  },
});
