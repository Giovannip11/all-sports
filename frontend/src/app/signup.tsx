import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsButton } from '@/components/design-system/as-button';
import { AsChip } from '@/components/design-system/as-chip';
import { AsField } from '@/components/design-system/as-field';
import { DSColors, DSSpacing, DSText } from '@/constants/design-system';
import { ApiError, type Role } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { isValidEmail, isValidPassword } from '@/utils/validation';

const SPORTS = ['Futebol', 'Corrida', 'Vôlei', 'Bike', 'Basquete', 'Natação'];

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [role, setRole] = useState<Role>('practice');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sports, setSports] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [sportsError, setSportsError] = useState('');
  const [formError, setFormError] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  function toggleSport(sport: string) {
    setSports((current) =>
      current.includes(sport) ? current.filter((s) => s !== sport) : [...current, sport],
    );
    setSportsError('');
  }

  async function handleSubmit() {
    const nextNameError = name.trim().length >= 2 ? '' : 'Digite seu nome';
    const nextEmailError = isValidEmail(email) ? '' : 'Digite um e-mail válido';
    const nextPasswordError = isValidPassword(password)
      ? ''
      : 'A senha precisa ter pelo menos 6 caracteres';
    const nextSportsError = sports.length > 0 ? '' : 'Escolha pelo menos um esporte';

    setNameError(nextNameError);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setSportsError(nextSportsError);
    setFormError('');
    if (nextNameError || nextEmailError || nextPasswordError || nextSportsError) return;

    setLoading(true);
    try {
      const { needsEmailConfirmation } = await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      });

      if (needsEmailConfirmation) {
        setAwaitingConfirmation(true);
        return;
      }

      router.replace('/main');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Erro inesperado ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  if (awaitingConfirmation) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={[styles.safeArea, styles.confirmWrap]}>
          <Text style={styles.confirmTitle}>Confirme seu e-mail</Text>
          <Text style={styles.confirmBody}>
            Enviamos um link de confirmação para {email}. Abra o e-mail e confirme antes de
            entrar.
          </Text>
          <Link href="/" asChild>
            <AsButton label="Ir para o login" variant="primary" block />
          </Link>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Voltar">
            <Text style={styles.backLabel}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Criar conta</Text>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled">
            <View style={styles.segment}>
              <Pressable
                style={[styles.segmentBtn, role === 'practice' && styles.segmentBtnActive]}
                onPress={() => setRole('practice')}>
                <Text
                  style={[styles.segmentLabel, role === 'practice' && styles.segmentLabelActive]}>
                  Praticar
                </Text>
              </Pressable>
              <Pressable
                style={[styles.segmentBtn, role === 'organize' && styles.segmentBtnActive]}
                onPress={() => setRole('organize')}>
                <Text
                  style={[
                    styles.segmentLabel,
                    role === 'organize' && styles.segmentLabelActive,
                  ]}>
                  Organizar
                </Text>
              </Pressable>
            </View>
            <Text style={styles.help}>
              {role === 'practice'
                ? 'Você pode organizar eventos depois, sem criar outra conta.'
                : 'Comece grátis organizando rachas. Para campeonatos com inscrição e cobrança, dá pra evoluir de plano quando quiser.'}
            </Text>

            {formError ? (
              <View style={styles.formError}>
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            <AsField
              label="Nome"
              placeholder="Seu nome"
              value={name}
              onChangeText={(value) => {
                setName(value);
                if (nameError) setNameError('');
              }}
              error={nameError}
            />
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
              placeholder="Crie uma senha"
              autoComplete="new-password"
              isPassword
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (passwordError) setPasswordError('');
              }}
              error={passwordError}
            />

            <View style={styles.sportsField}>
              <Text style={styles.label}>Esportes</Text>
              <View style={styles.chips}>
                {SPORTS.map((sport) => (
                  <AsChip
                    key={sport}
                    label={sport}
                    active={sports.includes(sport)}
                    onPress={() => toggleSport(sport)}
                  />
                ))}
              </View>
              {sportsError ? <Text style={styles.sportsError}>{sportsError}</Text> : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <SafeAreaView edges={['bottom']} style={styles.dock}>
          <AsButton
            label={loading ? 'Criando conta...' : 'Criar conta'}
            variant="primary"
            block
            loading={loading}
            onPress={handleSubmit}
          />
        </SafeAreaView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DSColors.surface,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DSSpacing[2],
    minHeight: 56,
    paddingHorizontal: DSSpacing[2],
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  backLabel: {
    fontSize: 24,
    fontWeight: '800',
    color: DSColors.ink,
  },
  headerTitle: {
    fontSize: DSText.xl,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: DSColors.ink,
  },
  content: {
    gap: 14,
    padding: DSSpacing[4],
    paddingBottom: DSSpacing[6],
  },
  segment: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    backgroundColor: DSColors.surface2,
    borderRadius: 10,
  },
  segmentBtn: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: DSColors.surface,
  },
  segmentLabel: {
    fontSize: DSText.sm,
    fontWeight: '800',
    color: DSColors.inkSecondary,
  },
  segmentLabelActive: {
    color: DSColors.ink,
  },
  help: {
    fontSize: DSText.xs,
    fontWeight: '600',
    color: DSColors.inkSecondary,
  },
  label: {
    fontSize: DSText.sm,
    fontWeight: '800',
    color: DSColors.ink,
  },
  sportsField: {
    gap: 6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sportsError: {
    fontSize: DSText.xs,
    fontWeight: '700',
    color: DSColors.danger,
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
  dock: {
    paddingHorizontal: DSSpacing[4],
    paddingTop: DSSpacing[3],
    borderTopWidth: 1,
    borderTopColor: DSColors.line,
    backgroundColor: DSColors.surface,
  },
  confirmWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: DSSpacing[3],
    padding: DSSpacing[6],
  },
  confirmTitle: {
    fontSize: DSText.xl,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: DSColors.ink,
    textAlign: 'center',
  },
  confirmBody: {
    fontSize: DSText.md,
    lineHeight: 21,
    color: DSColors.inkSecondary,
    textAlign: 'center',
    marginBottom: DSSpacing[3],
  },
});
