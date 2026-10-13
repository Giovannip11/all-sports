import { router } from 'expo-router';
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

type Role = 'practice' | 'organize';

const SPORTS = ['Futebol', 'Corrida', 'Vôlei', 'Bike', 'Basquete', 'Natação'];

export default function SignupScreen() {
  const [role, setRole] = useState<Role>('practice');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sports, setSports] = useState<string[]>([]);

  function toggleSport(sport: string) {
    setSports((current) =>
      current.includes(sport) ? current.filter((s) => s !== sport) : [...current, sport],
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
              Você pode organizar eventos depois, sem criar outra conta.
            </Text>

            <AsField label="Nome" placeholder="Seu nome" value={name} onChangeText={setName} />
            <AsField
              label="E-mail"
              placeholder="voce@email.com"
              autoComplete="email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <AsField
              label="Senha"
              placeholder="Crie uma senha"
              autoComplete="new-password"
              isPassword
              value={password}
              onChangeText={setPassword}
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
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <SafeAreaView edges={['bottom']} style={styles.dock}>
          <AsButton label="Criar conta" variant="primary" block onPress={() => router.replace('/main')} />
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
  dock: {
    paddingHorizontal: DSSpacing[4],
    paddingTop: DSSpacing[3],
    borderTopWidth: 1,
    borderTopColor: DSColors.line,
    backgroundColor: DSColors.surface,
  },
});
