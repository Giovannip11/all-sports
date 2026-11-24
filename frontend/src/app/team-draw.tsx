import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsButton } from '@/components/design-system/as-button';
import { AsField } from '@/components/design-system/as-field';
import { DSColors, DSRadius, DSSpacing, DSText } from '@/constants/design-system';
import { ApiError, type ApiEventDetail, type ApiTeamDraw, type TeamMode } from '@/lib/api';
import * as api from '@/lib/api';
import { useAuth } from '@/providers/auth-context';

const MODES: { value: TeamMode; label: string; help: string }[] = [
  { value: 'random', label: 'Aleatório', help: 'Sorteia os times sem nenhum critério.' },
  {
    value: 'balanced',
    label: 'Por experiência',
    help: 'Equilibra os times pelo número de eventos que cada um já participou.',
  },
];

export default function TeamDrawScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { accessToken } = useAuth();

  const [event, setEvent] = useState<ApiEventDetail | null>(null);
  const [draw, setDraw] = useState<ApiTeamDraw | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [teamCount, setTeamCount] = useState('2');
  const [mode, setMode] = useState<TeamMode>('random');
  const [drawing, setDrawing] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const detail = await api.getEvent(accessToken, eventId);
      setEvent(detail);
      try {
        setDraw(await api.getTeams(accessToken, eventId));
      } catch {
        setDraw(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar o evento');
    } finally {
      setLoading(false);
    }
  }, [accessToken, eventId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleDraw() {
    if (!accessToken || !eventId) return;
    const count = Number(teamCount);
    if (!Number.isInteger(count) || count < 2) {
      setError('Informe um número de times válido (mínimo 2)');
      return;
    }
    setError('');
    setDrawing(true);
    try {
      setDraw(await api.drawTeams(accessToken, eventId, { team_count: count, mode }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível sortear os times');
    } finally {
      setDrawing(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={DSColors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Voltar">
          <Text style={styles.backLabel}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Times</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.formError}>
            <Text style={styles.formErrorText}>{error}</Text>
          </View>
        ) : null}

        {event?.is_organizer && (
          <View style={styles.drawCard}>
            <Text style={styles.drawTitle}>
              {draw ? 'Sortear de novo' : 'Sortear times'}
            </Text>
            <AsField
              label="Número de times"
              placeholder="2"
              keyboardType="number-pad"
              value={teamCount}
              onChangeText={(v) => setTeamCount(v.replace(/\D/g, ''))}
            />
            <View style={styles.modeField}>
              <Text style={styles.label}>Critério</Text>
              {MODES.map((option) => (
                <Pressable
                  key={option.value}
                  style={[styles.modeOption, mode === option.value && styles.modeOptionActive]}
                  onPress={() => setMode(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: mode === option.value }}
                  accessibilityLabel={option.label}>
                  <View style={styles.modeOptionHeader}>
                    <View
                      style={[styles.radio, mode === option.value && styles.radioActive]}
                    />
                    <Text style={styles.modeOptionLabel}>{option.label}</Text>
                  </View>
                  <Text style={styles.modeOptionHelp}>{option.help}</Text>
                </Pressable>
              ))}
            </View>
            <AsButton
              label={drawing ? 'Sorteando...' : draw ? 'Sortear novamente' : 'Sortear times'}
              variant="primary"
              block
              loading={drawing}
              onPress={handleDraw}
            />
          </View>
        )}

        {!draw && !event?.is_organizer && (
          <Text style={styles.empty}>O organizador ainda não sorteou os times.</Text>
        )}

        {draw && (
          <View style={styles.teamsBlock}>
            {draw.teams.map((team) => (
              <View key={team.id} style={styles.teamCard}>
                <Text style={styles.teamName}>{team.name}</Text>
                {team.members.length === 0 && (
                  <Text style={styles.emptyMembers}>Nenhum jogador neste time.</Text>
                )}
                {team.members.map((member) => (
                  <View key={member.user_id} style={styles.memberRow}>
                    <Text style={styles.memberName}>{member.name || 'Participante'}</Text>
                    {draw.mode === 'balanced' && (
                      <Text style={styles.memberMeta}>
                        {member.events_played} evento{member.events_played === 1 ? '' : 's'}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DSColors.surface2 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: DSSpacing[2],
    backgroundColor: DSColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: DSColors.line,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  backLabel: { fontSize: 24, fontWeight: '800', color: DSColors.ink },
  headerTitle: { fontSize: DSText.xl, fontWeight: '800', letterSpacing: -0.6, color: DSColors.ink },
  content: { padding: DSSpacing[4], gap: DSSpacing[3] },
  formError: { padding: 12, borderRadius: 8, backgroundColor: DSColors.dangerTint },
  formErrorText: {
    fontSize: DSText.sm,
    fontWeight: '700',
    color: DSColors.danger,
    textAlign: 'center',
  },
  drawCard: {
    backgroundColor: DSColors.surface,
    borderRadius: DSRadius.xl,
    borderWidth: 1,
    borderColor: DSColors.line,
    padding: DSSpacing[4],
    gap: DSSpacing[3],
  },
  drawTitle: { fontSize: DSText.lg, fontWeight: '800', color: DSColors.ink },
  label: { fontSize: DSText.sm, fontWeight: '800', color: DSColors.ink },
  modeField: { gap: 8 },
  modeOption: {
    borderWidth: 1,
    borderColor: DSColors.line,
    borderRadius: DSRadius.lg,
    padding: DSSpacing[3],
    gap: 4,
  },
  modeOptionActive: { borderColor: DSColors.primary, backgroundColor: DSColors.primaryTint },
  modeOptionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: DSColors.lineStrong,
  },
  radioActive: { borderColor: DSColors.primary, backgroundColor: DSColors.primary },
  modeOptionLabel: { fontSize: DSText.sm, fontWeight: '800', color: DSColors.ink },
  modeOptionHelp: {
    fontSize: DSText.xs,
    fontWeight: '600',
    color: DSColors.inkSecondary,
    marginLeft: 24,
  },
  empty: {
    textAlign: 'center',
    marginTop: DSSpacing[6],
    fontSize: DSText.sm,
    fontWeight: '600',
    color: DSColors.inkSecondary,
  },
  teamsBlock: { gap: DSSpacing[3] },
  teamCard: {
    backgroundColor: DSColors.surface,
    borderRadius: DSRadius.lg,
    borderWidth: 1,
    borderColor: DSColors.line,
    padding: DSSpacing[3],
    gap: 6,
  },
  teamName: { fontSize: DSText.md, fontWeight: '800', color: DSColors.ink },
  emptyMembers: { fontSize: DSText.sm, fontWeight: '600', color: DSColors.inkSecondary },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: DSColors.line,
  },
  memberName: { fontSize: DSText.sm, fontWeight: '700', color: DSColors.ink },
  memberMeta: { fontSize: DSText.xs, fontWeight: '700', color: DSColors.inkSecondary },
});
