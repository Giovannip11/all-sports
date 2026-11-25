import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { DSRadius, DSSpacing, DSType, type DSColorSet } from '@/constants/design-system';
import { useDSColors } from '@/providers/theme-context';

import { AsButton } from './as-button';
import { AsIcon, type IconName } from './as-icon';

export type AsEmptyProps = {
  icon: IconName;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
  style?: StyleProp<ViewStyle>;
};

/** Estado vazio: diz o que falta e oferece o próximo passo. */
export function AsEmpty({ icon, title, body, action, style }: AsEmptyProps) {
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.empty, style]}>
      <View style={styles.iconWrap}>
        <AsIcon name={icon} size={24} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action ? (
        <AsButton
          label={action.label}
          icon={action.icon}
          size="sm"
          variant="secondary"
          onPress={action.onPress}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    empty: {
      alignItems: 'center',
      gap: DSSpacing[2],
      paddingVertical: DSSpacing[7],
      paddingHorizontal: DSSpacing[5],
      borderRadius: DSRadius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: DSColors.lineStrong,
      backgroundColor: DSColors.surface,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: DSRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: DSColors.primaryTint,
      marginBottom: DSSpacing[1],
    },
    title: {
      ...DSType.bodyStrong,
      color: DSColors.ink,
      textAlign: 'center',
    },
    body: {
      ...DSType.small,
      color: DSColors.inkSecondary,
      textAlign: 'center',
      maxWidth: 300,
    },
    action: {
      marginTop: DSSpacing[2],
    },
  });
}
