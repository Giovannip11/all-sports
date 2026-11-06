import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
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

import { AsButton } from '@/components/design-system/as-button';
import { AsField } from '@/components/design-system/as-field';
import { DSColors, DSRadius, DSSpacing, DSText } from '@/constants/design-system';
import { BottomTabInset } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { isValidPhone } from '@/utils/validation';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

const ROLE_LABEL: Record<string, string> = {
  practice: 'Jogador',
  organize: 'Organizador',
};

export default function ProfileScreen() {
  const { user, updateProfile, uploadAvatar } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');

  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formError, setFormError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

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
    const extension = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mime = extension === 'png' ? 'image/png' : 'image/jpeg';

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

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[
              styles.content,
              { paddingBottom: BottomTabInset + DSSpacing[6] },
            ]}
            keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Perfil</Text>

            <View style={styles.avatarSection}>
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
                    <Text style={styles.avatarPlaceholderText}>{initials(user?.name ?? '')}</Text>
                  </View>
                )}
                {uploadingAvatar && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color={DSColors.inverse} />
                  </View>
                )}
              </Pressable>
              <Pressable onPress={handlePickAvatar} disabled={uploadingAvatar} hitSlop={8}>
                <Text style={styles.changePhoto}>Trocar foto</Text>
              </Pressable>
            </View>

            {user?.role && (
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{ROLE_LABEL[user.role] ?? user.role}</Text>
              </View>
            )}

            {formError ? (
              <View style={styles.formError}>
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}
            {savedMessage ? (
              <View style={styles.formSuccess}>
                <Text style={styles.formSuccessText}>{savedMessage}</Text>
              </View>
            ) : null}

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
                  setPhone(value);
                  if (phoneError) setPhoneError('');
                  setSavedMessage('');
                }}
                error={phoneError}
              />
              <AsField
                label="Bio"
                placeholder="Conte um pouco sobre você e os esportes que pratica"
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
          </ScrollView>
        </KeyboardAvoidingView>
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
  content: {
    gap: DSSpacing[4],
    padding: DSSpacing[4],
  },
  title: {
    fontSize: DSText.xl,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: DSColors.ink,
  },
  avatarSection: {
    alignItems: 'center',
    gap: DSSpacing[2],
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.primaryTint,
  },
  avatarPlaceholderText: {
    fontSize: DSText['2xl'],
    fontWeight: '800',
    color: DSColors.primary,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  changePhoto: {
    fontSize: DSText.sm,
    fontWeight: '800',
    color: DSColors.primary,
  },
  roleBadge: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    height: 26,
    borderRadius: DSRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.accentTint,
  },
  roleBadgeText: {
    fontSize: DSText.xs,
    fontWeight: '800',
    color: DSColors.accentPressed,
  },
  stack: {
    gap: DSSpacing[3] + 2,
  },
  bioInput: {
    height: 96,
    paddingTop: 12,
    textAlignVertical: 'top',
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
  formSuccess: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: DSColors.primaryTint,
  },
  formSuccessText: {
    fontSize: DSText.sm,
    fontWeight: '700',
    color: DSColors.primary,
    textAlign: 'center',
  },
});
