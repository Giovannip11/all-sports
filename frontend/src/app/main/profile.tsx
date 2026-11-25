import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsBadge } from '@/components/design-system/as-badge';
import { AsBanner } from '@/components/design-system/as-banner';
import { AsButton } from '@/components/design-system/as-button';
import { AsConfirm } from '@/components/design-system/as-confirm';
import { AsField } from '@/components/design-system/as-field';
import { AsIcon } from '@/components/design-system/as-icon';
import { AsColumn } from '@/components/design-system/as-layout';
import { AsSegmented } from '@/components/design-system/as-segmented';
import { SportsPreferences } from '@/components/profile/sports-preferences';
import {
  BottomTabInset,
  DSRadius,
  DSSpacing,
  DSText,
  DSType,
  type DSColorSet,
} from '@/constants/design-system';
import { ApiError, type Role } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { useDSColors, useTheme, type ThemeMode } from '@/providers/theme-context';
import { initials } from '@/utils/format';
import { formatPhone } from '@/utils/masks';
import { isValidPhone } from '@/utils/validation';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'practice', label: 'Jogador' },
  { value: 'organize', label: 'Organizador' },
];

const ROLE_LABEL: Record<string, string> = {
  practice: 'Jogador',
  organize: 'Organizador',
};

const PLAN_LABEL: Record<string, string> = {
  gratuito: 'Gratuito',
  casual: 'Casual',
  intermediario: 'Intermediário',
  arena: 'Arena',
};

export default function ProfileScreen() {
  const { user, signOut, updateProfile, uploadAvatar, deleteAccount } = useAuth();
  const { mode, setMode } = useTheme();
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(formatPhone(user?.phone ?? ''));
  const [bio, setBio] = useState(user?.bio ?? '');

  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formError, setFormError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const [savingRole, setSavingRole] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [roleMessage, setRoleMessage] = useState('');

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function handlePickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFormError('Precisamos de acesso às suas fotos para trocar o avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    // Na web a uri é um data:/blob: URL (sem extensão), então o tipo vem do
    // mimeType informado pelo seletor quando existir.
    const AVATAR_TYPES: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const mime =
      asset.mimeType && AVATAR_TYPES[asset.mimeType]
        ? asset.mimeType
        : asset.uri.toLowerCase().endsWith('.png')
          ? 'image/png'
          : 'image/jpeg';
    const extension = AVATAR_TYPES[mime];

    setFormError('');
    setSavedMessage('');
    setUploadingAvatar(true);
    try {
      await uploadAvatar({ uri: asset.uri, name: `avatar.${extension}`, type: mime });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Erro ao enviar a foto');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave() {
    const nextNameError = name.trim().length >= 2 ? '' : 'Digite seu nome';
    const nextPhoneError = isValidPhone(phone) ? '' : 'Digite um telefone válido com DDD';

    setNameError(nextNameError);
    setPhoneError(nextPhoneError);
    setFormError('');
    setSavedMessage('');
    if (nextNameError || nextPhoneError) return;

    setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim(), bio: bio.trim() });
      setSavedMessage('Perfil atualizado.');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Erro ao salvar o perfil');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError('');
    setDeletingAccount(true);
    try {
      // Sem sessão, o Stack.Protected do _layout volta para o login sozinho.
      await deleteAccount();
    } catch (error) {
      setDeleteError(error instanceof ApiError ? error.message : 'Erro ao excluir a conta');
      setDeletingAccount(false);
    }
  }

  async function handleChangeRole(next: Role) {
    if (!user || next === user.role || savingRole) return;
    setRoleError('');
    setRoleMessage('');
    setSavingRole(true);
    try {
      await updateProfile({ role: next });
      setRoleMessage(
        next === 'organize'
          ? 'Agora você é Organizador. O botão + para criar eventos aparece no mapa e em Eventos.'
          : 'Agora você é Jogador.',
      );
    } catch (error) {
      setRoleError(error instanceof ApiError ? error.message : 'Não foi possível trocar o tipo de conta');
    } finally {
      setSavingRole(false);
    }
  }

  function handleSignOut() {
    signOut();
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[
              styles.content,
              { paddingBottom: BottomTabInset + DSSpacing[6] },
            ]}
            keyboardShouldPersistTaps="handled">
            <AsColumn width="form" style={styles.column}>
              <Text style={styles.title} accessibilityRole="header">
                Perfil
              </Text>

              <View style={styles.identity}>
                <Pressable
                  onPress={handlePickAvatar}
                  disabled={uploadingAvatar}
                  style={styles.avatarWrap}
                  accessibilityRole="button"
                  accessibilityLabel="Trocar foto de perfil">
                  {user?.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarPlaceholderText}>
                        {initials(user?.name ?? '')}
                      </Text>
                    </View>
                  )}
                  {uploadingAvatar ? (
                    <View style={styles.avatarOverlay}>
                      <ActivityIndicator color={colors.inverse} />
                    </View>
                  ) : (
                    <View style={styles.avatarEdit}>
                      <AsIcon name="edit" size={16} color={colors.onPrimary} />
                    </View>
                  )}
                </Pressable>
                <View style={styles.identityText}>
                  <Text style={styles.name} numberOfLines={2}>
                    {user?.name || 'Seu perfil'}
                  </Text>
                  {user?.role ? (
                    <AsBadge
                      label={ROLE_LABEL[user.role] ?? user.role}
                      tone={user.role === 'organize' ? 'accent' : 'primary'}
                    />
                  ) : null}
                  <Pressable onPress={handlePickAvatar} disabled={uploadingAvatar} hitSlop={12}>
                    <Text style={styles.changePhoto}>Trocar foto</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tipo de conta</Text>
                <AsSegmented
                  value={user?.role ?? 'practice'}
                  onChange={handleChangeRole}
                  options={ROLE_OPTIONS}
                />
                <Text style={styles.roleHelp}>
                  {user?.role === 'organize'
                    ? 'Você cria eventos, sorteia times e também pode participar dos rachas dos outros.'
                    : 'Você encontra e participa de eventos. Mude para Organizador para criar os seus.'}
                </Text>
                {savingRole ? (
                  <ActivityIndicator color={colors.primary} style={styles.alignStart} />
                ) : null}
                {roleError ? <AsBanner tone="error" message={roleError} /> : null}
                {roleMessage ? <AsBanner tone="success" message={roleMessage} /> : null}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Esportes e nível</Text>
                <SportsPreferences />
              </View>

              <Pressable
                onPress={() => router.push('/history')}
                style={({ pressed }) => [styles.linkRow, pressed && styles.planRowPressed]}
                accessibilityRole="button"
                accessibilityLabel="Meus eventos: histórico de eventos que você participou">
                <AsIcon name="calendar" size={22} color={colors.primary} />
                <View style={styles.flex}>
                  <Text style={styles.planRowValue}>Meus eventos</Text>
                  <Text style={styles.planRowLabel}>Os que você já jogou e os próximos</Text>
                </View>
                <AsIcon name="forward" size={18} color={colors.primary} />
              </Pressable>

              {user?.role === 'organize' && (
                <Pressable
                  onPress={() => router.push('/plans')}
                  style={({ pressed }) => [styles.planRow, pressed && styles.planRowPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Plano atual: ${PLAN_LABEL[user.plan] ?? user.plan}. Mudar de plano`}>
                  <View style={styles.planIcon}>
                    <AsIcon name="trophy" size={22} color={colors.onAccent} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.planRowLabel}>Plano atual</Text>
                    <Text style={styles.planRowValue}>{PLAN_LABEL[user.plan] ?? user.plan}</Text>
                  </View>
                  <Text style={styles.planRowAction}>Mudar plano</Text>
                  <AsIcon name="forward" size={18} color={colors.primary} />
                </Pressable>
              )}

              <Text style={styles.sectionTitle}>Seus dados</Text>

              {formError ? <AsBanner tone="error" message={formError} /> : null}
              {savedMessage ? <AsBanner tone="success" message={savedMessage} /> : null}

              <View style={styles.stack}>
                <AsField label="E-mail" value={user?.email ?? ''} editable={false} />
                <AsField
                  label="Nome"
                  placeholder="Seu nome"
                  value={name}
                  onChangeText={(value) => {
                    setName(value);
                    if (nameError) setNameError('');
                    setSavedMessage('');
                  }}
                  error={nameError}
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
                    setSavedMessage('');
                  }}
                  error={phoneError}
                />
                <AsField
                  label="Bio"
                  placeholder="Conte um pouco sobre você e os esportes que pratica"
                  helpText={`${bio.length}/280`}
                  value={bio}
                  onChangeText={(value) => {
                    setBio(value);
                    setSavedMessage('');
                  }}
                  multiline
                  numberOfLines={4}
                  style={styles.bioInput}
                  maxLength={280}
                />
              </View>

              <AsButton
                label={savingProfile ? 'Salvando...' : 'Salvar alterações'}
                variant="primary"
                block
                loading={savingProfile}
                onPress={handleSave}
              />

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Aparência</Text>
                <AsSegmented value={mode} onChange={setMode} options={THEME_OPTIONS} />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Conta</Text>
                <AsButton
                  label="Sair da conta"
                  variant="secondary"
                  icon="logout"
                  block
                  onPress={handleSignOut}
                />
              </View>

              <View style={styles.dangerZone}>
                <Text style={styles.sectionTitle}>Zona de risco</Text>
                {deleteError ? <AsBanner tone="error" message={deleteError} /> : null}
                {!confirmingDelete ? (
                  <AsButton
                    label="Excluir minha conta"
                    variant="dangerGhost"
                    icon="trash"
                    style={styles.deleteButton}
                    onPress={() => setConfirmingDelete(true)}
                  />
                ) : (
                  <AsConfirm
                    destructive
                    message="Isso apaga sua conta, foto, eventos que você organiza e suas inscrições, sem volta. Tem certeza?"
                    cancelLabel="Cancelar"
                    confirmLabel={deletingAccount ? 'Excluindo...' : 'Sim, excluir'}
                    loading={deletingAccount}
                    onCancel={() => setConfirmingDelete(false)}
                    onConfirm={handleDeleteAccount}
                  />
                )}
              </View>
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
      padding: DSSpacing[4],
    },
    column: {
      gap: DSSpacing[4],
    },
    title: {
      ...DSType.title,
      color: DSColors.ink,
    },
    identity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DSSpacing[4],
    },
    identityText: {
      flex: 1,
      gap: DSSpacing[1],
      alignItems: 'flex-start',
    },
    name: {
      ...DSType.headline,
      color: DSColors.ink,
    },
    avatarWrap: {
      width: 88,
      height: 88,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: DSRadius.lg,
    },
    avatarPlaceholder: {
      width: '100%',
      height: '100%',
      borderRadius: DSRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: DSColors.primary,
    },
    avatarPlaceholderText: {
      ...DSType.display,
      fontSize: DSText['2xl'],
      lineHeight: 36,
      color: DSColors.onPrimary,
    },
    avatarOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: DSRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: DSColors.scrim,
    },
    avatarEdit: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: DSColors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: DSColors.primary,
    },
    changePhoto: {
      ...DSType.labelStrong,
      color: DSColors.primary,
      paddingVertical: DSSpacing[1],
    },
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DSSpacing[3],
      padding: DSSpacing[3],
      borderRadius: DSRadius.md,
      borderWidth: 1,
      borderColor: DSColors.line,
      backgroundColor: DSColors.surface,
    },
    planRowPressed: {
      backgroundColor: DSColors.surface2,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DSSpacing[3],
      padding: DSSpacing[3],
      minHeight: 56,
      borderRadius: DSRadius.md,
      borderWidth: 1,
      borderColor: DSColors.line,
      backgroundColor: DSColors.surface,
    },
    planIcon: {
      width: 44,
      height: 44,
      borderRadius: DSRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: DSColors.accent,
    },
    planRowLabel: {
      ...DSType.meta,
      color: DSColors.inkSecondary,
    },
    planRowValue: {
      ...DSType.bodyStrong,
      color: DSColors.ink,
    },
    planRowAction: {
      ...DSType.labelStrong,
      color: DSColors.primary,
    },
    sectionTitle: {
      ...DSType.labelStrong,
      color: DSColors.inkSecondary,
    },
    section: {
      gap: DSSpacing[2],
      marginTop: DSSpacing[2],
    },
    roleHelp: {
      ...DSType.meta,
      color: DSColors.inkSecondary,
    },
    alignStart: {
      alignSelf: 'flex-start',
    },
    stack: {
      gap: DSSpacing[4],
    },
    bioInput: {
      height: 104,
      paddingTop: DSSpacing[3],
      textAlignVertical: 'top',
    },
    dangerZone: {
      marginTop: DSSpacing[4],
      paddingTop: DSSpacing[4],
      borderTopWidth: 1,
      borderTopColor: DSColors.line,
      gap: DSSpacing[2],
    },
    deleteButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: DSSpacing[2],
    },
  });
}
