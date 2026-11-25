import { router } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DSFonts, DSLayout, DSSpacing, DSText, type DSColorSet } from '@/constants/design-system';
import { useAuth } from '@/providers/auth-context';
import { useDSColors } from '@/providers/theme-context';

import { AsIconButton } from './as-icon-button';

export type AsHeaderProps = {
  title?: string;
  /** Padrão: router.back(). Passe `null` para esconder o botão voltar. */
  onBack?: (() => void) | null;
  right?: ReactNode;
  /** Linha inferior separando o header do conteúdo. */
  bordered?: boolean;
};

/** Header das telas empilhadas: voltar, título e ações à direita. */
export function AsHeader({ title, onBack, right, bordered }: AsHeaderProps) {
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  // Sem histórico (página aberta direto pelo link ou recarregada), router.back()
  // não faz nada — então volta para a tela inicial do app.
  const handleBack =
    onBack === undefined
      ? () => (router.canGoBack() ? router.back() : router.replace(user ? '/main' : '/'))
      : onBack;

  return (
    <View style={[styles.header, bordered && styles.bordered]}>
      {handleBack ? (
        <AsIconButton icon="back" label="Voltar" onPress={handleBack} />
      ) : (
        <View style={styles.spacer} />
      )}
      {title ? (
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      ) : (
        <View style={styles.flex} />
      )}
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DSSpacing[1],
      minHeight: 56,
      paddingHorizontal: DSSpacing[1],
      backgroundColor: DSColors.surface,
    },
    bordered: {
      borderBottomWidth: 1,
      borderBottomColor: DSColors.line,
    },
    spacer: {
      width: DSSpacing[3],
    },
    title: {
      flex: 1,
      fontFamily: DSFonts.display,
      fontSize: DSText.xl,
      lineHeight: 28,
      color: DSColors.ink,
    },
    flex: {
      flex: 1,
    },
    right: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DSSpacing[1],
      paddingRight: DSSpacing[1],
      minHeight: DSLayout.touch,
    },
  });
}
