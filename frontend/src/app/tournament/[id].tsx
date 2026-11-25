import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsBadge } from '@/components/design-system/as-badge';
import { AsBanner } from '@/components/design-system/as-banner';
import { AsButton } from '@/components/design-system/as-button';
import { AsOption } from '@/components/design-system/as-choice';
import { AsConfirm } from '@/components/design-system/as-confirm';
import { AsEmpty } from '@/components/design-system/as-empty';
import { AsField } from '@/components/design-system/as-field';
import { AsHeader } from '@/components/design-system/as-header';
import { AsIcon, type IconName } from '@/components/design-system/as-icon';
import { AsColumn } from '@/components/design-system/as-layout';
import { DSRadius, DSSpacing, DSText, DSType, type DSColorSet } from '@/constants/design-system';
import { SPORT_TYPES, type SportKey } from '@/constants/discover';
import {
  ApiError,
  type ApiMatch,
  type ApiTournament,
  type TournamentTeamStatus,
} from '@/lib/api';
import * as api from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { useDSColors } from '@/providers/theme-context';
import { dateParts } from '@/utils/format';

const TEAM_STATUS: Record<TournamentTeamStatus, { label: string; tone: 'primary' | 'neutral' | 'danger' | 'accent' }> = {
  confirmed: { label: 'Confirmada', tone: 'primary' },
  pending: { label: 'Aguardando', tone: 'neutral' },
  waitlisted: { label: 'Lista de espera', tone: 'neutral' },
  rejected: { label: 'Recusada', tone: 'danger' },
  canceled: { label: 'Cancelada', tone: 'danger' },
};

/** TOUR-01 — campeonato em mata-mata: inscrição de equipes, chaveamento e resultados. */
export default function TournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken } = useAuth();
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [tournament, setTournament] = useState<ApiTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const [teamName, setTeamName] = useState('');
  const [teamNameError, setTeamNameError] = useState('');
  const [confirming, setConfirming] = useState<'cancelTeam' | 'bracket' | null>(null);

  const [editingMatch, setEditingMatch] = useState<ApiMatch | null>(null);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [tieWinner, setTieWinner] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    try {
      setTournament(await api.getTournament(accessToken, id));
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o torneio');
    } finally {
      setLoading(false);
    }
  }, [accessToken, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function act(key: string, fn: () => Promise<ApiTournament>, success: string) {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      setTournament(await fn());
      setNotice(success);
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível completar a ação');
      return false;
    } finally {
      setBusy(null);
    }
  }

  if (loading && !tournament) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <AsHeader title="Torneio" />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <AsHeader title="Torneio" />
        <View style={styles.centeredPadded}>
          <AsEmpty
            icon="alert"
            title={error || 'Torneio não encontrado'}
            body="Ele pode ter sido removido ou o link está incompleto."
            action={{ label: 'Tentar de novo', icon: 'refresh', onPress: load }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const t = tournament;
  const token = accessToken!;
  const sport = SPORT_TYPES[t.sport as SportKey];
  const when = dateParts(t.starts_at);
  const myTeam = t.teams.find((team) => team.is_mine) ?? null;
  const open = t.status === 'open' || t.status === 'full';
  const hasBracket = t.rounds.length > 0;
  const canceled = t.status === 'canceled';

  function openResult(match: ApiMatch) {
    setEditingMatch(match);
    setHomeScore(match.home_score != null ? String(match.home_score) : '');
    setAwayScore(match.away_score != null ? String(match.away_score) : '');
    setTieWinner(match.winner_team_id);
    setError('');
    setNotice('');
  }

  async function saveResult() {
    if (!editingMatch) return;
    const home = Number(homeScore);
    const away = Number(awayScore);
    if (homeScore === '' || awayScore === '' || !Number.isInteger(home) || !Number.isInteger(away)) {
      setError('Informe o placar das duas equipes.');
      return;
    }
    if (home === away && !tieWinner) {
      setError('Empate no mata-mata: escolha quem avança.');
      return;
    }
    const ok = await act(
      'result',
      () =>
        api.recordMatchResult(token, t.id, editingMatch.id, {
          home_score: home,
          away_score: away,
          winner_team_id: home === away ? tieWinner : null,
        }),
      'Resultado salvo. O vencedor já foi para a próxima fase.',
    );
    if (ok) setEditingMatch(null);
  }

  async function registerTeam() {
    if (teamName.trim().length < 2) {
      setTeamNameError('Dê um nome para a equipe');
      return;
    }
    const ok = await act(
      'register',
      () => api.registerTournamentTeam(token, t.id, teamName.trim()),
      'Equipe inscrita! Você é o capitão. Acompanhe o status aqui.',
    );
    if (ok) setTeamName('');
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AsHeader title="Torneio" bordered />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AsColumn style={styles.column}>
          {error ? <AsBanner tone="error" message={error} /> : null}
          {notice ? <AsBanner tone="success" message={notice} /> : null}

          <View style={styles.hero}>
            <View style={styles.tags}>
              <View style={[styles.dot, { backgroundColor: sport?.color ?? colors.inkTertiary }]} />
              <Text style={styles.sport}>{sport?.label ?? t.sport}</Text>
              <AsBadge label="Torneio" tone="accent" />
              {canceled && <AsBadge label="Cancelado" tone="danger" />}
              {t.is_organizer && <AsBadge label="Você organiza" tone="primary" />}
            </View>
            <Text style={styles.title} accessibilityRole="header">
              {t.title}
            </Text>
          </View>

          {t.champion && (
            <View style={styles.champion} accessibilityRole="summary">
              <AsIcon name="trophy" size={28} color={colors.onAccent} />
              <View style={styles.flex}>
                <Text style={styles.championLabel}>Campeão</Text>
                <Text style={styles.championName}>{t.champion.name}</Text>
              </View>
            </View>
          )}

          <View style={styles.scoreboard}>
            <View style={styles.scoreCell}>
              <Text style={styles.scoreLabel}>Quando</Text>
              <Text style={styles.scoreValue}>{when.time}</Text>
              <Text style={styles.scoreSub}>
                {when.weekday} {when.day}
              </Text>
            </View>
            <View style={styles.scoreDivider} />
            <View style={styles.scoreCell}>
              <Text style={styles.scoreLabel}>Equipes</Text>
              <Text style={styles.scoreValue}>
                {t.confirmed_teams}
                <Text style={styles.scoreValueSub}>/{t.max_teams}</Text>
              </Text>
              <Text style={styles.scoreSub}>confirmadas</Text>
            </View>
          </View>

          <View style={styles.facts}>
            <Fact icon="pin" label="Local" value={t.location} styles={styles} color={colors.inkSecondary} />
            <Fact
              icon="user"
              label="Organizador"
              value={t.organizer_name || 'Organizador'}
              styles={styles}
              color={colors.inkSecondary}
            />
            <Fact
              icon="users"
              label="Jogadores por equipe"
              value={
                t.players_per_team_min === t.players_per_team_max
                  ? String(t.players_per_team_max)
                  : `${t.players_per_team_min} a ${t.players_per_team_max}`
              }
              styles={styles}
              color={colors.inkSecondary}
            />
            {t.prize_description ? (
              <Fact
                icon="trophy"
                label="Premiação"
                value={t.prize_description}
                styles={styles}
                color={colors.inkSecondary}
              />
            ) : null}
          </View>

          {t.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sobre</Text>
              <Text style={styles.body}>{t.description}</Text>
            </View>
          ) : null}

          {/* Inscrição da equipe (quem não organiza). */}
          {!t.is_organizer && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sua equipe</Text>
              {myTeam ? (
                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>{myTeam.name}</Text>
                    <AsBadge
                      label={TEAM_STATUS[myTeam.status].label}
                      tone={TEAM_STATUS[myTeam.status].tone}
                    />
                  </View>
                  <Text style={styles.meta}>
                    {myTeam.status === 'confirmed'
                      ? 'Vaga garantida. O chaveamento sai quando o organizador sortear.'
                      : myTeam.status === 'waitlisted'
                        ? 'O torneio está cheio. Se uma equipe sair, a sua entra.'
                        : myTeam.status === 'pending'
                          ? 'Aguardando aprovação do organizador.'
                          : 'Inscrição encerrada.'}
                  </Text>
                  {!hasBracket &&
                    ['pending', 'confirmed', 'waitlisted'].includes(myTeam.status) &&
                    (confirming === 'cancelTeam' ? (
                      <AsConfirm
                        destructive
                        message="Cancelar a inscrição da equipe libera a vaga. Para voltar, será preciso inscrever de novo."
                        cancelLabel="Voltar"
                        confirmLabel="Sim, cancelar"
                        loading={busy === 'cancelTeam'}
                        onCancel={() => setConfirming(null)}
                        onConfirm={() =>
                          act(
                            'cancelTeam',
                            () => api.cancelTournamentTeam(token, myTeam.id),
                            'Inscrição da equipe cancelada.',
                          ).then(() => setConfirming(null))
                        }
                      />
                    ) : (
                      <AsButton
                        label="Cancelar inscrição da equipe"
                        variant="dangerGhost"
                        size="sm"
                        icon="close"
                        onPress={() => setConfirming('cancelTeam')}
                      />
                    ))}
                </View>
              ) : open ? (
                <View style={styles.card}>
                  <AsField
                    label="Nome da equipe"
                    placeholder="Ex.: Unidos da Várzea"
                    value={teamName}
                    maxLength={60}
                    onChangeText={(v) => {
                      setTeamName(v);
                      setTeamNameError('');
                    }}
                    error={teamNameError}
                    onSubmitEditing={registerTeam}
                  />
                  <Text style={styles.meta}>
                    Você será o capitão.
                    {t.status === 'full' ? ' O torneio está cheio: a equipe entra na lista de espera.' : ''}
                  </Text>
                  <AsButton
                    label={t.status === 'full' ? 'Entrar na lista de espera' : 'Inscrever equipe'}
                    icon="plus"
                    block
                    loading={busy === 'register'}
                    onPress={registerTeam}
                  />
                </View>
              ) : (
                <Text style={styles.meta}>As inscrições estão fechadas.</Text>
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Equipes ({t.teams.length})</Text>
            {t.teams.length === 0 ? (
              <Text style={styles.meta}>Nenhuma equipe inscrita ainda.</Text>
            ) : (
              t.teams.map((team) => (
                <View key={team.id} style={styles.teamRow}>
                  <View style={styles.flex}>
                    <Text style={styles.teamName}>
                      {team.name}
                      {team.is_mine ? ' (sua)' : ''}
                    </Text>
                    <Text style={styles.meta}>Capitão: {team.captain_name || '—'}</Text>
                  </View>
                  <AsBadge label={TEAM_STATUS[team.status].label} tone={TEAM_STATUS[team.status].tone} />
                  {t.is_organizer && t.requires_approval && team.status === 'pending' && (
                    <View style={styles.decision}>
                      <AsButton
                        label="Aprovar"
                        size="sm"
                        loading={busy === `approve-${team.id}`}
                        onPress={() =>
                          act(
                            `approve-${team.id}`,
                            () => api.decideTournamentTeam(token, team.id, true),
                            `Equipe "${team.name}" aprovada.`,
                          )
                        }
                      />
                      <AsButton
                        label="Recusar"
                        size="sm"
                        variant="dangerGhost"
                        loading={busy === `reject-${team.id}`}
                        onPress={() =>
                          act(
                            `reject-${team.id}`,
                            () => api.decideTournamentTeam(token, team.id, false),
                            `Equipe "${team.name}" recusada.`,
                          )
                        }
                      />
                    </View>
                  )}
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Chaveamento</Text>
              {t.is_organizer && !canceled && hasBracket && confirming !== 'bracket' && (
                <AsButton
                  label="Refazer"
                  icon="shuffle"
                  size="sm"
                  variant="ghost"
                  onPress={() => setConfirming('bracket')}
                />
              )}
            </View>

            {t.is_organizer && !canceled && confirming === 'bracket' && (
              <AsConfirm
                destructive={hasBracket}
                message={
                  hasBracket
                    ? 'Refazer sorteia de novo e apaga todos os resultados já lançados.'
                    : `Sortear o mata-mata com as ${t.confirmed_teams} equipes confirmadas? Equipes que entrarem depois ficam de fora.`
                }
                cancelLabel="Voltar"
                confirmLabel={hasBracket ? 'Sim, refazer' : 'Gerar chaveamento'}
                loading={busy === 'bracket'}
                onCancel={() => setConfirming(null)}
                onConfirm={() =>
                  act('bracket', () => api.generateBracket(token, t.id), 'Chaveamento gerado.').then(() =>
                    setConfirming(null),
                  )
                }
              />
            )}

            {!hasBracket && confirming !== 'bracket' && (
              <AsEmpty
                icon="trophy"
                title="Chaveamento ainda não sorteado"
                body={
                  t.is_organizer
                    ? t.confirmed_teams >= 2
                      ? 'Quando as inscrições fecharem, gere o mata-mata com as equipes confirmadas.'
                      : 'É preciso de pelo menos 2 equipes confirmadas.'
                    : 'O organizador sorteia os confrontos quando as inscrições fecharem.'
                }
                action={
                  t.is_organizer && !canceled && t.confirmed_teams >= 2
                    ? { label: 'Gerar chaveamento', icon: 'shuffle', onPress: () => setConfirming('bracket') }
                    : undefined
                }
              />
            )}

            {hasBracket && (
              <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.bracket}>
                {t.rounds.map((round) => (
                  <View key={round.round} style={styles.roundColumn}>
                    <Text style={styles.roundName}>{round.name}</Text>
                    {round.matches.map((match) => {
                      const ready = !!match.home && !!match.away;
                      const editable = t.is_organizer && ready && !canceled;
                      const card = (
                        <>
                          <MatchSide
                            name={match.home?.name ?? 'A definir'}
                            score={match.home_score}
                            winner={!!match.winner_team_id && match.winner_team_id === match.home?.id}
                            styles={styles}
                          />
                          <MatchSide
                            name={match.away?.name ?? 'A definir'}
                            score={match.away_score}
                            winner={!!match.winner_team_id && match.winner_team_id === match.away?.id}
                            styles={styles}
                          />
                          {editable && (
                            <Text style={styles.matchAction}>
                              {match.status === 'finished' ? 'Corrigir placar' : 'Lançar resultado'}
                            </Text>
                          )}
                        </>
                      );
                      return editable ? (
                        <Pressable
                          key={match.id}
                          onPress={() => openResult(match)}
                          accessibilityRole="button"
                          accessibilityLabel={`${match.home?.name} contra ${match.away?.name}. ${match.status === 'finished' ? `${match.home_score} a ${match.away_score}` : 'Lançar resultado'}`}
                          style={({ pressed }) => [
                            styles.match,
                            editingMatch?.id === match.id && styles.matchActive,
                            pressed && styles.matchPressed,
                          ]}>
                          {card}
                        </Pressable>
                      ) : (
                        <View key={match.id} style={styles.match}>
                          {card}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            )}

            {editingMatch && editingMatch.home && editingMatch.away && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Resultado</Text>
                <View style={styles.scoreInputs}>
                  <View style={styles.flex}>
                    <AsField
                      label={editingMatch.home.name}
                      keyboardType="number-pad"
                      placeholder="0"
                      value={homeScore}
                      onChangeText={(v) => setHomeScore(v.replace(/\D/g, '').slice(0, 3))}
                    />
                  </View>
                  <Text style={styles.versus}>x</Text>
                  <View style={styles.flex}>
                    <AsField
                      label={editingMatch.away.name}
                      keyboardType="number-pad"
                      placeholder="0"
                      value={awayScore}
                      onChangeText={(v) => setAwayScore(v.replace(/\D/g, '').slice(0, 3))}
                    />
                  </View>
                </View>
                {homeScore !== '' && homeScore === awayScore && (
                  <View style={styles.tie} accessibilityRole="radiogroup">
                    <Text style={styles.meta}>Empate: quem avança (pênaltis/desempate)?</Text>
                    {[editingMatch.home, editingMatch.away].map((team) => (
                      <AsOption
                        key={team.id}
                        label={team.name}
                        selected={tieWinner === team.id}
                        onSelect={() => setTieWinner(team.id)}
                      />
                    ))}
                  </View>
                )}
                <View style={styles.rowButtons}>
                  <AsButton
                    label="Cancelar"
                    variant="secondary"
                    style={styles.flex}
                    onPress={() => setEditingMatch(null)}
                  />
                  <AsButton
                    label="Salvar resultado"
                    style={styles.flex}
                    loading={busy === 'result'}
                    onPress={saveResult}
                  />
                </View>
              </View>
            )}
          </View>
        </AsColumn>
      </ScrollView>
    </SafeAreaView>
  );
}

function Fact({
  icon,
  label,
  value,
  styles,
  color,
}: {
  icon: IconName;
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
  color: string;
}) {
  return (
    <View style={styles.fact}>
      <AsIcon name={icon} size={20} color={color} />
      <View style={styles.flex}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue}>{value}</Text>
      </View>
    </View>
  );
}

function MatchSide({
  name,
  score,
  winner,
  styles,
}: {
  name: string;
  score: number | null;
  winner: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.side}>
      <Text style={[styles.sideName, winner && styles.sideWinner]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.sideScore, winner && styles.sideWinner]}>{score ?? '–'}</Text>
    </View>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: DSColors.surface },
    flex: { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    centeredPadded: { flex: 1, justifyContent: 'center', padding: DSSpacing[4] },
    content: { padding: DSSpacing[4], paddingBottom: DSSpacing[7] },
    column: { gap: DSSpacing[5] },
    hero: { gap: DSSpacing[2] },
    tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: DSSpacing[2] },
    dot: { width: 10, height: 10, borderRadius: 5 },
    sport: { ...DSType.labelStrong, color: DSColors.inkSecondary },
    title: { ...DSType.display, color: DSColors.ink },
    champion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DSSpacing[3],
      padding: DSSpacing[4],
      borderRadius: DSRadius.md,
      backgroundColor: DSColors.accent,
    },
    championLabel: { ...DSType.labelStrong, color: DSColors.onAccent },
    championName: { ...DSType.title, color: DSColors.onAccent },
    scoreboard: {
      flexDirection: 'row',
      borderRadius: DSRadius.md,
      backgroundColor: DSColors.surface2,
      padding: DSSpacing[4],
      gap: DSSpacing[4],
    },
    scoreCell: { flex: 1, gap: 2 },
    scoreDivider: { width: 1, backgroundColor: DSColors.lineStrong },
    scoreLabel: { ...DSType.labelStrong, color: DSColors.inkSecondary },
    scoreValue: { ...DSType.score, color: DSColors.ink },
    scoreValueSub: { ...DSType.scoreSm, color: DSColors.inkSecondary },
    scoreSub: { ...DSType.meta, color: DSColors.inkSecondary },
    facts: { gap: DSSpacing[3] },
    fact: { flexDirection: 'row', alignItems: 'flex-start', gap: DSSpacing[3] },
    factLabel: { ...DSType.meta, color: DSColors.inkSecondary },
    factValue: { ...DSType.body, color: DSColors.ink },
    section: { gap: DSSpacing[3] },
    sectionTitle: { ...DSType.headline, color: DSColors.ink },
    body: { ...DSType.body, color: DSColors.ink },
    meta: { ...DSType.small, color: DSColors.inkSecondary },
    card: {
      gap: DSSpacing[3],
      padding: DSSpacing[4],
      borderRadius: DSRadius.md,
      borderWidth: 1,
      borderColor: DSColors.line,
      backgroundColor: DSColors.surface,
    },
    cardTitle: { ...DSType.bodyStrong, color: DSColors.ink },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: DSSpacing[2],
    },
    teamRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: DSSpacing[2],
      paddingVertical: DSSpacing[2],
      borderBottomWidth: 1,
      borderBottomColor: DSColors.line,
    },
    teamName: { ...DSType.bodyStrong, color: DSColors.ink },
    decision: { flexDirection: 'row', gap: DSSpacing[2], width: '100%', justifyContent: 'flex-end' },
    bracket: { gap: DSSpacing[4], paddingBottom: DSSpacing[2] },
    roundColumn: { width: 200, gap: DSSpacing[3], justifyContent: 'space-around' },
    roundName: { ...DSType.labelStrong, color: DSColors.inkSecondary, textAlign: 'center' },
    match: {
      borderRadius: DSRadius.md,
      borderWidth: 1,
      borderColor: DSColors.line,
      backgroundColor: DSColors.surface,
      overflow: 'hidden',
    },
    matchActive: { borderColor: DSColors.primary, borderWidth: 2 },
    matchPressed: { backgroundColor: DSColors.surface2 },
    matchAction: {
      ...DSType.meta,
      fontWeight: '700',
      color: DSColors.primary,
      paddingHorizontal: DSSpacing[3],
      paddingBottom: DSSpacing[2],
    },
    side: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DSSpacing[2],
      paddingHorizontal: DSSpacing[3],
      paddingVertical: DSSpacing[2],
    },
    sideName: { ...DSType.small, flex: 1, color: DSColors.ink },
    sideScore: { ...DSType.scoreSm, fontSize: DSText.md, color: DSColors.inkSecondary },
    sideWinner: { color: DSColors.primary, fontWeight: '700' },
    scoreInputs: { flexDirection: 'row', alignItems: 'flex-end', gap: DSSpacing[2] },
    versus: { ...DSType.headline, color: DSColors.inkSecondary, paddingBottom: DSSpacing[3] },
    tie: { gap: DSSpacing[2] },
    rowButtons: { flexDirection: 'row', gap: DSSpacing[2] },
  });
}
