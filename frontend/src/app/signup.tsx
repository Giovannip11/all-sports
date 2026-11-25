import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsBanner } from '@/components/design-system/as-banner';
import { AsButton } from '@/components/design-system/as-button';
import { AsChip } from '@/components/design-system/as-chip';
import { AsCheckbox } from '@/components/design-system/as-choice';
import { AsField } from '@/components/design-system/as-field';
import { AsHeader } from '@/components/design-system/as-header';
import { AsIcon } from '@/components/design-system/as-icon';
import { AsColumn } from '@/components/design-system/as-layout';
import { AsSegmented } from '@/components/design-system/as-segmented';
import { DSRadius, DSSpacing, DSType, type DSColorSet } from '@/constants/design-system';
import { SPORT_KEYS, SPORT_TYPES, type SportKey } from '@/constants/discover';
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
  // Slugs na ordem em que foram tocados = prioridade (RF05).
  const [sports, setSports] = useState<SportKey[]>([]);
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

  function toggleSport(sport: SportKey) {
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
        // Antes os esportes eram validados aqui e nunca enviados.
        sports,
      });

      // Sem confirmação de e-mail a sessão já começa e o Stack.Protected leva
      // para /main sozinho.
      if (needsEmailConfirmation) {
        setAwaitingConfirmation(true);
      }
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Erro inesperado ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  const hasFieldErrors = !!(
    nameError ||
    emailError ||
    phoneError ||
    passwordError ||
    birthDateError ||
    cpfError ||
    genderError ||
    sportsError ||
    termsError
  );

  if (awaitingConfirmation) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={[styles.safeArea, styles.confirmWrap]}>
          <AsColumn width="form" style={styles.confirmColumn}>
            <View style={styles.confirmIcon}>
              <AsIcon name="check" size={28} color={colors.primary} />
            </View>
            <Text style={styles.confirmTitle} accessibilityRole="header">
              Confirme seu e-mail
            </Text>
            <Text style={styles.confirmBody}>
              Enviamos um link de confirmação para {email}. Abra o e-mail e confirme antes de
              entrar.
            </Text>
            <Link href="/" asChild>
              <AsButton label="Ir para o login" variant="primary" block />
            </Link>
          </AsColumn>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <AsHeader title="Criar conta" bordered />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled">
            <AsColumn width="form" style={styles.column}>
              <View style={styles.field}>
                <Text style={styles.label}>Você quer</Text>
                <AsSegmented
                  value={role}
                  onChange={setRole}
                  options={[
                    { value: 'practice', label: 'Praticar', accessibilityLabel: 'Quero praticar' },
                    { value: 'organize', label: 'Organizar', accessibilityLabel: 'Quero organizar' },
                  ]}
                />
                <Text style={styles.help}>
                  {role === 'practice'
                    ? 'Você pode organizar eventos depois, sem criar outra conta.'
                    : 'Comece grátis organizando rachas. Para campeonatos com inscrição e cobrança, dá pra evoluir de plano quando quiser.'}
                </Text>
              </View>

              {formError ? <AsBanner tone="error" message={formError} /> : null}

              <AsField
                label="Nome"
                placeholder="Seu nome"
                autoComplete="name"
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
                helpText="Pelo menos 6 caracteres."
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (passwordError) setPasswordError('');
                }}
                error={passwordError}
              />
              <View style={styles.row}>
                <View style={styles.rowField}>
                  <AsField
                    label="Nascimento"
                    placeholder="DD/MM/AAAA"
                    keyboardType="numbers-and-punctuation"
                    value={birthDate}
                    onChangeText={(value) => {
                      setBirthDate(formatDate(value));
                      if (birthDateError) setBirthDateError('');
                    }}
                    error={birthDateError}
                  />
                </View>
                <View style={styles.rowField}>
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
                </View>
              </View>

              <View style={styles.field}>
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
                {genderError ? <Text style={styles.error}>{genderError}</Text> : null}
              </View>

              <View style={styles.field}>
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

              <View style={styles.field}>
                <Text style={styles.label}>Esportes que você pratica</Text>
                <View style={styles.chips}>
                  {SPORT_KEYS.map((sport) => (
                    <AsChip
                      key={sport}
                      label={SPORT_TYPES[sport].label}
                      dotColor={SPORT_TYPES[sport].color}
                      active={sports.includes(sport)}
                      onPress={() => toggleSport(sport)}
                    />
                  ))}
                </View>
                <Text style={styles.help}>
                  A ordem em que você toca vira a sua prioridade. Dá para mudar e informar seu nível
                  no perfil.
                </Text>
                {sportsError ? <Text style={styles.error}>{sportsError}</Text> : null}
              </View>

              <View style={styles.consent}>
                <AsCheckbox
                  checked={acceptedTerms}
                  onToggle={() => {
                    setAcceptedTerms((v) => !v);
                    if (termsError) setTermsError('');
                  }}
                  label="Li e aceito os termos de uso e a política de privacidade."
                />
                {termsError ? <Text style={styles.error}>{termsError}</Text> : null}

                <AsCheckbox
                  checked={locationConsent}
                  onToggle={() => setLocationConsent((v) => !v)}
                  label="Autorizo o uso da minha localização para mostrar eventos e quadras perto de mim (opcional, pode ser ativado depois)."
                />
              </View>
            </AsColumn>
          </ScrollView>
        </KeyboardAvoidingView>

        <SafeAreaView edges={['bottom']} style={styles.dock}>
          <AsColumn width="form" style={styles.dockColumn}>
            {formError ? (
              <AsBanner tone="error" message={formError} />
            ) : hasFieldErrors ? (
              <AsBanner tone="error" message="Revise os campos marcados em vermelho." />
            ) : null}
            <AsButton
              label={loading ? 'Criando conta...' : 'Criar conta'}
              variant="primary"
              block
              loading={loading}
              onPress={handleSubmit}
            />
          </AsColumn>
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
    content: {
      padding: DSSpacing[4],
      paddingBottom: DSSpacing[6],
    },
    column: {
      gap: DSSpacing[5],
    },
    field: {
      gap: DSSpacing[2],
    },
    row: {
      flexDirection: 'row',
      gap: DSSpacing[3],
    },
    rowField: {
      flex: 1,
    },
    help: {
      ...DSType.meta,
      color: DSColors.inkSecondary,
    },
    label: {
      ...DSType.label,
      color: DSColors.ink,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DSSpacing[2],
    },
    error: {
      ...DSType.meta,
      fontWeight: '700',
      color: DSColors.danger,
    },
    consent: {
      gap: DSSpacing[1],
    },
    dock: {
      paddingHorizontal: DSSpacing[4],
      paddingTop: DSSpacing[3],
      paddingBottom: DSSpacing[3],
      borderTopWidth: 1,
      borderTopColor: DSColors.line,
      backgroundColor: DSColors.surface,
    },
    dockColumn: {
      gap: DSSpacing[2],
    },
    confirmWrap: {
      justifyContent: 'center',
      padding: DSSpacing[6],
    },
    confirmColumn: {
      gap: DSSpacing[3],
    },
    confirmIcon: {
      width: 56,
      height: 56,
      borderRadius: DSRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: DSColors.primaryTint,
    },
    confirmTitle: {
      ...DSType.title,
      color: DSColors.ink,
    },
    confirmBody: {
      ...DSType.body,
      color: DSColors.inkSecondary,
      marginBottom: DSSpacing[3],
    },
  });
}
