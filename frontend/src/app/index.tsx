import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsBanner } from '@/components/design-system/as-banner';
import { AsButton } from '@/components/design-system/as-button';
import { AsField } from '@/components/design-system/as-field';
import { AsColumn } from '@/components/design-system/as-layout';
import { AsLogo } from '@/components/design-system/as-logo';
import { DSSpacing, DSType, type DSColorSet } from '@/constants/design-system';
import { ApiError, forgotPassword } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { useDSColors } from '@/providers/theme-context';
import { isValidEmail, isValidPassword } from '@/utils/validation';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const [resetMode, setResetMode] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  async function handleForgotPassword() {
    if (!isValidEmail(email)) {
      setEmailError('Digite um e-mail válido');
      return;
    }
    setResetSending(true);
    setResetMessage('');
    try {
      await forgotPassword(email.trim());
    } catch {
      // Intentionally ignored — the backend already responds the same way
      // whether the e-mail exists or not, so any error here is transient.
    } finally {
      setResetSending(false);
      setResetMessage(
        `Se ${email.trim()} tiver uma conta, enviamos um link de recuperação pro e-mail.`,
      );
    }
  }

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
      // A troca para /main acontece sozinha: com a sessão ativa, o login deixa
      // de estar disponível no Stack.Protected do _layout.
      await signIn(email.trim(), password);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Erro inesperado ao entrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled">
            <AsColumn width="form" style={styles.column}>
              <View style={styles.hero}>
                <AsLogo size={88} />
                <Text style={styles.title} accessibilityRole="header">
                  {resetMode ? 'Recuperar senha' : 'Bora jogar?'}
                </Text>
                <Text style={styles.lead}>
                  {resetMode
                    ? 'Informe o e-mail da sua conta e enviamos um link para criar uma nova senha.'
                    : 'Encontre um racha, um grupo ou um campeonato perto de você — ou organize o seu.'}
                </Text>
              </View>

              {formError ? <AsBanner tone="error" message={formError} /> : null}
              {resetMessage ? <AsBanner tone="success" message={resetMessage} /> : null}

              {resetMode ? (
                <>
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
                  </View>

                  <AsButton
                    label={resetSending ? 'Enviando...' : 'Enviar link de recuperação'}
                    variant="primary"
                    block
                    loading={resetSending}
                    onPress={handleForgotPassword}
                  />

                  <AsButton
                    label="Voltar para o login"
                    variant="ghost"
                    icon="back"
                    block
                    onPress={() => {
                      setResetMode(false);
                      setResetMessage('');
                    }}
                  />
                </>
              ) : (
                <>
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
                      onSubmitEditing={handleSubmit}
                      returnKeyType="go"
                      error={passwordError}
                      labelAction={{
                        label: 'Esqueci a senha',
                        onPress: () => {
                          setResetMode(true);
                          setResetMessage('');
                          setFormError('');
                          setEmailError('');
                          setPasswordError('');
                        },
                      }}
                    />
                  </View>

                  <AsButton
                    label={loading ? 'Entrando...' : 'Entrar'}
                    variant="primary"
                    block
                    loading={loading}
                    onPress={handleSubmit}
                  />

                  <View style={styles.footer}>
                    <Text style={styles.footerText}>Ainda não tem conta?</Text>
                    <Link href="/signup" asChild>
                      <AsButton label="Criar conta" variant="secondary" block />
                    </Link>
                  </View>
                </>
              )}
            </AsColumn>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: DSColors.surface,
    },
    flex: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: DSSpacing[6],
    },
    column: {
      gap: DSSpacing[5],
    },
    hero: {
      alignItems: 'flex-start',
      gap: DSSpacing[3],
      marginBottom: DSSpacing[2],
    },
    title: {
      ...DSType.display,
      color: DSColors.ink,
      marginTop: DSSpacing[2],
    },
    lead: {
      ...DSType.body,
      color: DSColors.inkSecondary,
      maxWidth: 360,
    },
    stack: {
      gap: DSSpacing[4],
    },
    footer: {
      gap: DSSpacing[2],
      alignItems: 'stretch',
      marginTop: DSSpacing[2],
      paddingTop: DSSpacing[5],
      borderTopWidth: 1,
      borderTopColor: DSColors.line,
    },
    footerText: {
      ...DSType.small,
      color: DSColors.inkSecondary,
      textAlign: 'center',
    },
  });
}
