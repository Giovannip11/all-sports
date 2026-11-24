import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { DSSpacing, DSText, type DSColorSet } from '@/constants/design-system';
import { ApiError, type Gender, type Role } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { useDSColors } from '@/providers/theme-context';
import { formatCPF, formatDate, formatPhone } from '@/utils/masks';
import {
  isOldEnough,
  isValidCPF,
  isValidEmail,
  isValidPassword,
  isValidPhone,
  parseBirthDate,
} from '@/utils/validation';

const SPORTS = ['Futebol', 'Corrida', 'Vôlei', 'Bike', 'Basquete', 'Natação'];

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'outro', label: 'Outro' },
  { value: 'prefiro_nao_informar', label: 'Prefiro não informar' },
];

const COUNTRIES = ['Brasil', 'Portugal', 'Outro'];

export default function SignupScreen() {
  const { signUp } = useAuth();
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [role, setRole] = useState<Role>('practice');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [cpf, setCpf] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [country, setCountry] = useState('Brasil');
  const [sports, setSports] = useState<string[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [birthDateError, setBirthDateError] = useState('');
  const [cpfError, setCpfError] = useState('');
  const [genderError, setGenderError] = useState('');
  const [sportsError, setSportsError] = useState('');
  const [termsError, setTermsError] = useState('');
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
    const nextPhoneError = isValidPhone(phone) ? '' : 'Digite um telefone válido com DDD';
    const nextPasswordError = isValidPassword(password)
      ? ''
      : 'A senha precisa ter pelo menos 6 caracteres';
    const isoBirthDate = parseBirthDate(birthDate);
    const nextBirthDateError = !isoBirthDate
      ? 'Use o formato DD/MM/AAAA'
      : !isOldEnough(isoBirthDate)
        ? 'Você precisa ter pelo menos 16 anos'
        : '';
    const nextCpfError = isValidCPF(cpf) ? '' : 'Digite um CPF válido';
    const nextGenderError = gender ? '' : 'Selecione uma opção';
    const nextSportsError = sports.length > 0 ? '' : 'Escolha pelo menos um esporte';
    const nextTermsError = acceptedTerms ? '' : 'Você precisa aceitar os termos de uso';

    setNameError(nextNameError);
    setEmailError(nextEmailError);
    setPhoneError(nextPhoneError);
    setPasswordError(nextPasswordError);
    setBirthDateError(nextBirthDateError);
    setCpfError(nextCpfError);
    setGenderError(nextGenderError);
    setSportsError(nextSportsError);
    setTermsError(nextTermsError);
    setFormError('');
    if (
      nextNameError ||
      nextEmailError ||
      nextPhoneError ||
      nextPasswordError ||
      nextBirthDateError ||
      nextCpfError ||
      nextGenderError ||
      nextSportsError ||
      nextTermsError ||
      !isoBirthDate ||
      !gender
    )
      return;

    setLoading(true);
    try {
      const { needsEmailConfirmation } = await signUp({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        birth_date: isoBirthDate,
        cpf: cpf.replace(/\D/g, ''),
        gender,
        country,
        role,
        accepted_terms: acceptedTerms,
        location_consent: locationConsent,
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
                onPress={() => setRole('practice')}
                accessibilityRole="radio"
                accessibilityState={{ selected: role === 'practice' }}
                accessibilityLabel="Quero praticar">
                <Text
                  style={[styles.segmentLabel, role === 'practice' && styles.segmentLabelActive]}>
                  Praticar
                </Text>
              </Pressable>
              <Pressable
                style={[styles.segmentBtn, role === 'organize' && styles.segmentBtnActive]}
                onPress={() => setRole('organize')}
                accessibilityRole="radio"
                accessibilityState={{ selected: role === 'organize' }}
                accessibilityLabel="Quero organizar">
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
              label="Telefone"
              placeholder="(11) 99999-9999"
              autoComplete="tel"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(value) => {
                setPhone(formatPhone(value));
                if (phoneError) setPhoneError('');
              }}
              error={phoneError}
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
            <AsField
              label="Data de nascimento"
              placeholder="DD/MM/AAAA"
              keyboardType="numbers-and-punctuation"
              value={birthDate}
              onChangeText={(value) => {
                setBirthDate(formatDate(value));
                if (birthDateError) setBirthDateError('');
              }}
              error={birthDateError}
            />
            <AsField
              label="CPF"
              placeholder="000.000.000-00"
              keyboardType="number-pad"
              value={cpf}
              onChangeText={(value) => {
                setCpf(formatCPF(value));
                if (cpfError) setCpfError('');
              }}
              error={cpfError}
            />

            <View style={styles.sportsField}>
              <Text style={styles.label}>Gênero</Text>
              <View style={styles.chips}>
                {GENDERS.map((option) => (
                  <AsChip
                    key={option.value}
                    label={option.label}
                    active={gender === option.value}
                    onPress={() => {
                      setGender(option.value);
                      if (genderError) setGenderError('');
                    }}
                  />
                ))}
              </View>
              {genderError ? <Text style={styles.sportsError}>{genderError}</Text> : null}
            </View>

            <View style={styles.sportsField}>
              <Text style={styles.label}>País</Text>
              <View style={styles.chips}>
                {COUNTRIES.map((option) => (
                  <AsChip
                    key={option}
                    label={option}
                    active={country === option}
                    onPress={() => setCountry(option)}
                  />
                ))}
              </View>
            </View>

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

            <View style={styles.consentField}>
              <Pressable
                style={styles.checkboxRow}
                onPress={() => {
                  setAcceptedTerms((v) => !v);
                  if (termsError) setTermsError('');
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTerms }}>
                <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                  {acceptedTerms && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>
                  Li e aceito os termos de uso e a política de privacidade.
                </Text>
              </Pressable>
              {termsError ? <Text style={styles.sportsError}>{termsError}</Text> : null}

              <Pressable
                style={styles.checkboxRow}
                onPress={() => setLocationConsent((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: locationConsent }}>
                <View style={[styles.checkbox, locationConsent && styles.checkboxChecked]}>
                  {locationConsent && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>
                  Autorizo o uso da minha localização para mostrar eventos e quadras perto de
                  mim (opcional, pode ser ativado depois).
                </Text>
              </Pressable>
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

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
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
  consentField: {
    gap: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: DSColors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: DSColors.primary,
    borderColor: DSColors.primary,
  },
  checkboxMark: {
    color: DSColors.inverse,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 14,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: DSText.xs,
    fontWeight: '600',
    color: DSColors.inkSecondary,
    lineHeight: 16,
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
}
