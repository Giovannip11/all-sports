import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsButton } from '@/components/design-system/as-button';
import { AsField } from '@/components/design-system/as-field';
import { DSColors, DSSpacing, DSText } from '@/constants/design-system';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { isValidEmail, isValidPassword } from '@/utils/validation';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const nextEmailError = isValidEmail(email) ? '' : 'Digite um e-mail válido';
    const nextPasswordError = isValidPassword(password)
      ? ''
      : 'A senha precisa ter pelo menos 6 caracteres';

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setFormError('');
    if (nextEmailError || nextPasswordError) return;

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/main');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Erro inesperado ao entrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled">
            <View style={styles.hero}>
              <View style={styles.logo}>
                <Image
                  style={styles.logoMark}
                  source={require('@/assets/images/expo-logo.png')}
                />
                <Text style={styles.logoText}>All Sports</Text>
              </View>
              <Text style={styles.lead}>
                Encontre um racha, um grupo ou um campeonato perto de você — ou organize o seu.
              </Text>
            </View>

            {formError ? (
              <View style={styles.formError}>
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            <View style={styles.stack}>
              <AsField
                label="E-mail"
                placeholder="voce@email.com"
                autoComplete="email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (emailError) setEmailError('');
                }}
                error={emailError}
              />
              <AsField
                label="Senha"
                placeholder="Sua senha"
                autoComplete="current-password"
                isPassword
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (passwordError) setPasswordError('');
                }}
                error={passwordError}
                labelAction={{ label: 'Esqueci', onPress: () => {} }}
              />
            </View>

            <AsButton
              label={loading ? 'Entrando...' : 'Entrar'}
              variant="primary"
              block
              loading={loading}
              onPress={handleSubmit}
            />

            <Text style={styles.footer}>
              Ainda não tem conta?{' '}
              <Link href="/signup" style={styles.footerLink}>
                Criar conta
              </Link>
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DSColors.bg,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: DSSpacing[6],
    gap: DSSpacing[6],
  },
  hero: {
    alignItems: 'center',
    gap: DSSpacing[3],
  },
  logo: {
    alignItems: 'center',
    gap: DSSpacing[3],
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: DSColors.primary,
  },
  logoText: {
    fontSize: DSText['3xl'],
    fontWeight: '800',
    letterSpacing: -1.2,
    color: DSColors.ink,
  },
  lead: {
    maxWidth: 280,
    textAlign: 'center',
    fontSize: DSText.md,
    lineHeight: 21,
    color: DSColors.inkSecondary,
  },
  stack: {
    gap: DSSpacing[3] + 2,
  },
  footer: {
    textAlign: 'center',
    fontSize: DSText.sm,
    color: DSColors.inkSecondary,
    fontWeight: '600',
  },
  footerLink: {
    color: DSColors.primary,
    fontWeight: '800',
  },
  formError: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: DSColors.dangerTint,
  },
  formErrorText: {
    fontSize: DSText.sm,
    fontWeight: '700',
    color: DSColors.danger,
    textAlign: 'center',
  },
});
