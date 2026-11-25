import '@/global.css';

import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/providers/auth-context';
import { ThemeProvider as AppThemeProvider, useTheme } from '@/providers/theme-context';

SplashScreen.preventAutoHideAsync();

function Navigation() {
  const { isDark, colors } = useTheme();

  // Fundo e cores da navegação vêm do design system, para não piscar branco
  // entre telas no modo escuro.
  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.bg,
        card: colors.surface,
        text: colors.ink,
        border: colors.line,
        notification: colors.danger,
      },
    };
  }, [isDark, colors]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthProvider>
        <AnimatedSplashOverlay />
        <RoutesStack background={colors.bg} />
      </AuthProvider>
    </NavigationThemeProvider>
  );
}

/**
 * Telas protegidas só existem com sessão ativa. Sem login, qualquer rota
 * interna (ex.: /main/events aberta direto ou depois de a sessão cair) volta
 * para o login, em vez de mostrar a tela vazia com botões que não fazem nada.
 */
function RoutesStack({ background }: { background: string }) {
  const { user, restoring } = useAuth();
  const { colors } = useTheme();

  if (restoring) {
    return (
      <View style={[styles.restoring, { backgroundColor: background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const signedIn = !!user;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="signup" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="main" />
        <Stack.Screen name="create-event" />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="plans" />
        <Stack.Screen name="team-draw" />
        <Stack.Screen name="event-chat" />
        <Stack.Screen name="history" />
        <Stack.Screen name="tournament/[id]" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  restoring: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default function RootLayout() {
  // Barlow Condensed é estática (um arquivo por peso). Manrope é variável e
  // entra pela web via @font-face em global.css — ver constants/design-system.ts.
  const [fontsLoaded, fontError] = useFonts({
    'BarlowCondensed-SemiBold': require('@/assets/fonts/BarlowCondensed-SemiBold.ttf'),
    'BarlowCondensed-Bold': require('@/assets/fonts/BarlowCondensed-Bold.ttf'),
  });

  // Se a fonte falhar, segue com a do sistema em vez de travar no splash.
  if (!fontsLoaded && !fontError) return null;

  return (
    <AppThemeProvider>
      <Navigation />
    </AppThemeProvider>
  );
}
