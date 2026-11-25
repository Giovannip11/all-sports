import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsBanner } from '@/components/design-system/as-banner';
import { AsButton } from '@/components/design-system/as-button';
import { AsOption } from '@/components/design-system/as-choice';
import { AsEmpty } from '@/components/design-system/as-empty';
import { AsField } from '@/components/design-system/as-field';
import { AsHeader } from '@/components/design-system/as-header';
import { AsColumn } from '@/components/design-system/as-layout';
import { DSRadius, DSSpacing, DSType, type DSColorSet } from '@/constants/design-system';
import { SKILL_LABEL } from '@/constants/discover';
import { ApiError, type ApiEventDetail, type ApiTeamDraw, type TeamMode } from '@/lib/api';
import * as api from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { useDSColors } from '@/providers/theme-context';

const MODES: { value: TeamMode; label: string; help: string }[] = [
  { value: 'random', label: 'Aleatório', help: 'Sorteia os times sem nenhum critério.' },
  {
    value: 'balanced',
    label: 'Equilibrado',
    help: 'Equilibra pelo nível que cada um informou no perfil para este esporte; empates pela experiência (eventos jogados).',
  },
];

export default function TeamDrawScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { accessToken } = useAuth();
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AsHeader title="Times" bordered />

      {loading && !event ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <AsColumn style={styles.column}>
            {error ? <AsBanner tone="error" message={error} /> : null}

            {event?.is_organizer && (
              <View style={styles.drawCard}>
                <Text style={styles.drawTitle}>{draw ? 'Sortear de novo' : 'Sortear times'}</Text>
                <AsField
                  label="Número de times"
                  placeholder="2"
                  keyboardType="number-pad"
                  value={teamCount}
                  onChangeText={(v) => setTeamCount(v.replace(/\D/g, ''))}
                />
                <View style={styles.modeField} accessibilityRole="radiogroup">
                  <Text style={styles.label}>Critério</Text>
                  {MODES.map((option) => (
                    <AsOption
                      key={option.value}
                      label={option.label}
                      help={option.help}
                      selected={mode === option.value}
                      onSelect={() => setMode(option.value)}
                    />
                  ))}
                </View>
                <AsButton
                  label={drawing ? 'Sorteando...' : draw ? 'Sortear novamente' : 'Sortear times'}
                  icon="shuffle"
                  variant="primary"
                  block
                  loading={drawing}
                  onPress={handleDraw}
                />
              </View>
            )}

            {!draw && !event?.is_organizer && (
              <AsEmpty
                icon="users"
                title="Times ainda não sorteados"
                body="Quando o organizador sortear, os times aparecem aqui."
                action={{ label: 'Atualizar', icon: 'refresh', onPress: load }}
              />
            )}

            {draw && (
              <View style={styles.teamsBlock}>
                {draw.teams.map((team, index) => (
                  <View key={team.id} style={styles.teamCard}>
                    <View style={styles.teamHeader}>
                      <View style={styles.teamNumber}>
                        <Text style={styles.teamNumberText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.teamName}>{team.name}</Text>
                      <Text style={styles.teamCount}>
                        {team.members.length} {team.members.length === 1 ? 'jogador' : 'jogadores'}
                      </Text>
                    </View>
                    {team.members.length === 0 && (
                      <Text style={styles.emptyMembers}>Nenhum jogador neste time.</Text>
                    )}
                    {team.members.map((member) => (
                      <View key={member.user_id} style={styles.memberRow}>
                        <Text style={styles.memberName}>{member.name || 'Participante'}</Text>
                        {draw.mode === 'balanced' && (
                          <Text style={styles.memberMeta}>
                            {member.skill_level ? SKILL_LABEL[member.skill_level] : 'Nível não informado'}
                            {' · '}
                            {member.events_played} evento{member.events_played === 1 ? '' : 's'}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </AsColumn>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: DSColors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: DSSpacing[4], paddingBottom: DSSpacing[7] },
    column: { gap: DSSpacing[4] },
    drawCard: {
      backgroundColor: DSColors.surface,
      borderRadius: DSRadius.md,
      borderWidth: 1,
      borderColor: DSColors.line,
      padding: DSSpacing[4],
      gap: DSSpacing[4],
    },
    drawTitle: { ...DSType.headline, color: DSColors.ink },
    label: { ...DSType.label, color: DSColors.ink },
    modeField: { gap: DSSpacing[2] },
    teamsBlock: { gap: DSSpacing[3] },
    teamCard: {
      backgroundColor: DSColors.surface,
      borderRadius: DSRadius.md,
      borderWidth: 1,
      borderColor: DSColors.line,
      padding: DSSpacing[4],
      gap: DSSpacing[1],
    },
    teamHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DSSpacing[3],
      marginBottom: DSSpacing[2],
    },
    teamNumber: {
      width: 40,
      height: 40,
      borderRadius: DSRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: DSColors.ink,
    },
    teamNumberText: { ...DSType.score, color: DSColors.surface },
    teamName: { ...DSType.headline, flex: 1, color: DSColors.ink },
    teamCount: { ...DSType.meta, color: DSColors.inkSecondary },
    emptyMembers: { ...DSType.small, color: DSColors.inkSecondary },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 40,
      borderTopWidth: 1,
      borderTopColor: DSColors.line,
    },
    memberName: { ...DSType.label, color: DSColors.ink },
    memberMeta: { ...DSType.meta, color: DSColors.inkSecondary },
  });
}
