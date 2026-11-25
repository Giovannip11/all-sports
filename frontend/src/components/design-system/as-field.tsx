import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import {
  DSLayout,
  DSRadius,
  DSSpacing,
  DSType,
  type DSColorSet,
} from '@/constants/design-system';
import { useDSColors } from '@/providers/theme-context';

import { AsIcon } from './as-icon';

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
  onFocus,
  onBlur,
  editable,
  ...rest
}: AsFieldProps) {
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [hidden, setHidden] = useState(isPassword);
  const [focused, setFocused] = useState(false);
  const readOnly = editable === false;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelAction && (
          <Pressable
            onPress={labelAction.onPress}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={labelAction.label}>
            <Text style={styles.labelAction}>{labelAction.label}</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.control}>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error || helpText}
          style={[
            styles.input,
            isPassword && styles.inputWithAccessory,
            focused && styles.inputFocused,
            !!error && styles.inputError,
            readOnly && styles.inputReadOnly,
            style,
          ]}
          placeholderTextColor={colors.inkTertiary}
          secureTextEntry={isPassword ? hidden : undefined}
          editable={editable}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...rest}
        />
        {isPassword && (
          <Pressable
            onPress={() => setHidden((v) => !v)}
            style={styles.accessory}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar senha' : 'Ocultar senha'}>
            <AsIcon name={hidden ? 'eye' : 'eyeOff'} size={20} color={colors.inkSecondary} />
          </Pressable>
        )}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : (
        !!helpText && <Text style={styles.help}>{helpText}</Text>
      )}
    </View>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    field: {
      gap: 6,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: DSSpacing[2],
    },
    label: {
      ...DSType.label,
      color: DSColors.ink,
    },
    labelAction: {
      ...DSType.labelStrong,
      color: DSColors.primary,
    },
    control: {
      position: 'relative',
      justifyContent: 'center',
    },
    input: {
      ...DSType.body,
      minHeight: DSLayout.control,
      paddingHorizontal: 14,
      borderRadius: DSRadius.sm,
      borderWidth: 1,
      borderColor: DSColors.lineStrong,
      backgroundColor: DSColors.surface,
      color: DSColors.ink,
    },
    inputWithAccessory: {
      paddingRight: DSLayout.touch + DSSpacing[1],
    },
    inputFocused: {
      borderColor: DSColors.primary,
      borderWidth: 2,
      paddingHorizontal: 13,
    },
    inputError: {
      borderColor: DSColors.danger,
    },
    inputReadOnly: {
      backgroundColor: DSColors.surface2,
      color: DSColors.inkSecondary,
    },
    accessory: {
      position: 'absolute',
      right: 2,
      width: DSLayout.touch,
      height: DSLayout.touch,
      alignItems: 'center',
      justifyContent: 'center',
    },
    help: {
      ...DSType.meta,
      color: DSColors.inkSecondary,
    },
    error: {
      ...DSType.meta,
      fontWeight: '700',
      color: DSColors.danger,
    },
  });
}
