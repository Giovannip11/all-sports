import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsBadge } from '@/components/design-system/as-badge';
import { AsBanner } from '@/components/design-system/as-banner';
import { AsButton } from '@/components/design-system/as-button';
import { AsConfirm } from '@/components/design-system/as-confirm';
import { AsEmpty } from '@/components/design-system/as-empty';
import { AsHeader } from '@/components/design-system/as-header';
import { AsIcon, type IconName } from '@/components/design-system/as-icon';
import { AsColumn } from '@/components/design-system/as-layout';
import { LocationPicker } from '@/components/location-picker';
import {
  DSRadius,
  DSSpacing,
  DSText,
  DSType,
  type DSColorSet,
} from '@/constants/design-system';
import { SPORT_TYPES, type SportKey } from '@/constants/discover';
import { ApiError, type ApiEventDetail } from '@/lib/api';
import * as api from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { useDSColors } from '@/providers/theme-context';
import { dateParts, initials } from '@/utils/format';

type PendingAction = 'join' | 'leave' | 'presence' | 'cancel' | null;

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken, user } = useAuth();
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [event, setEvent] = useState<ApiEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingLocation, setEditingLocation] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  // Só para a interface: qual botão mostra o spinner e se a confirmação de
  // cancelamento está aberta. As chamadas à API continuam as mesmas.
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const detail = await api.getEvent(accessToken, id);
      // Torneio tem tela própria (equipes e chaveamento). Links de notificação,
      // histórico etc. apontam para /event/:id e são redirecionados daqui.
      if (detail.kind === 'tournament') {
        router.replace(`/tournament/${detail.id}`);
        return;
      }
      setEvent(detail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar o evento');
    } finally {
      setLoading(false);
    }
  }, [accessToken, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleSaveLocation() {
    if (!accessToken || !event || !pendingCoords) return;
    setSavingLocation(true);
    setError('');
    try {
      await api.updateEvent(accessToken, event.id, {
        latitude: pendingCoords.latitude,
        longitude: pendingCoords.longitude,
      });
      setEditingLocation(false);
      await load();
      setNotice('Local atualizado. Os inscritos foram avisados.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o local');
    } finally {
      setSavingLocation(false);
    }
  }

  // UX-02: antes, ao participar, o app saía para a lista sem dizer nada; agora
  // fica no evento, atualiza as vagas e confirma com uma mensagem.
  async function handleJoin() {
    if (!accessToken || !event) return;
    await withAction(
      () => api.joinEvent(accessToken, event.id),
      'Inscrição confirmada! Você já aparece na lista de participantes.',
      'Não foi possível confirmar a participação',
    );
  }

  async function withAction(
    fn: () => Promise<unknown>,
    successMessage?: string,
    fallbackError = 'Não foi possível completar a ação',
  ) {
    setActionLoading(true);
    setError('');
    setNotice('');
    try {
      await fn();
      await load();
      if (successMessage) setNotice(successMessage);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallbackError);
    } finally {
      setActionLoading(false);
    }
  }

  async function run(action: Exclude<PendingAction, null>, fn: () => Promise<void>) {
    setPendingAction(action);
    try {
      await fn();
    } finally {
      setPendingAction(null);
    }
  }

  // Primeira carga sem dados: header + spinner (antes era tela vazia sem "voltar").
  if (loading && !event) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <AsHeader />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <AsHeader />
        <View style={styles.centeredPadded}>
          <AsEmpty
            icon="alert"
            title={error || 'Evento não encontrado'}
            body="Ele pode ter sido removido ou o link está incompleto."
            action={{ label: 'Tentar de novo', icon: 'refresh', onPress: load }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const sportInfo = SPORT_TYPES[event.sport as SportKey];
  const full = event.participants_count >= event.max_participants;
  const canceled = event.status === 'canceled';
  const myParticipation = event.participants.find((p) => p.user_id === user?.id);
  const when = dateParts(event.starts_at);
  const fill = Math.min(1, event.participants_count / Math.max(1, event.max_participants));

  function openChat() {
    if (!event) return;
    router.push({ pathname: '/event-chat', params: { eventId: event.id, title: event.title } });
  }

  function openTeams() {
    if (!event) return;
    router.push({ pathname: '/team-draw', params: { eventId: event.id } });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AsHeader bordered />

      <ScrollView contentContainerStyle={styles.content}>
        <AsColumn style={styles.column}>
          {error ? <AsBanner tone="error" message={error} /> : null}
          {notice ? <AsBanner tone="success" message={notice} /> : null}

          <View style={styles.hero}>
            <View style={styles.tags}>
              <View
                style={[styles.sportDot, { backgroundColor: sportInfo?.color ?? colors.inkTertiary }]}
              />
              <Text style={styles.sport}>{sportInfo?.label ?? event.sport}</Text>
              <AsBadge
                label={event.visibility === 'private' ? 'Privado' : 'Público'}
                tone="neutral"
              />
              {canceled && <AsBadge label="Cancelado" tone="danger" />}
              {!canceled && full && <AsBadge label="Lotado" tone="danger" />}
              {event.is_organizer && <AsBadge label="Você organiza" tone="primary" />}
            </View>
            <Text style={styles.title} accessibilityRole="header">
              {event.title}
            </Text>
          </View>

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
              <Text style={styles.scoreLabel}>Vagas</Text>
              <Text style={styles.scoreValue}>
                {event.participants_count}
                <Text style={styles.scoreValueSub}>/{event.max_participants}</Text>
              </Text>
              <View style={styles.slotsTrack}>
                <View
                  style={[
                    styles.slotsFill,
                    { width: `${fill * 100}%` as const },
                    full && styles.slotsFillFull,
                  ]}
                />
              </View>
            </View>
          </View>

          <View style={styles.facts}>
            <Fact
              icon="pin"
              label="Local"
              value={event.location}
              styles={styles}
              iconColor={colors.inkSecondary}
              action={
                event.is_organizer && !canceled && !editingLocation ? (
                  <Pressable
                    onPress={() => {
                      setPendingCoords({ latitude: event.latitude, longitude: event.longitude });
                      setEditingLocation(true);
                    }}
                    hitSlop={12}
                    style={styles.factAction}
                    accessibilityRole="button"
                    accessibilityLabel="Editar local do evento">
                    <AsIcon name="edit" size={16} color={colors.primary} />
                    <Text style={styles.factActionText}>Editar</Text>
                  </Pressable>
                ) : null
              }
            />

            {editingLocation && pendingCoords && (
              <View style={styles.editLocationBlock}>
                <LocationPicker
                  latitude={pendingCoords.latitude}
                  longitude={pendingCoords.longitude}
                  onChange={(latitude, longitude) => setPendingCoords({ latitude, longitude })}
                />
                <View style={styles.rowButtons}>
                  <AsButton
                    label="Cancelar"
                    variant="secondary"
                    style={styles.flex}
                    disabled={savingLocation}
                    onPress={() => setEditingLocation(false)}
                  />
                  <AsButton
                    label={savingLocation ? 'Salvando...' : 'Salvar local'}
                    variant="primary"
                    style={styles.flex}
                    loading={savingLocation}
                    onPress={handleSaveLocation}
                  />
                </View>
              </View>
            )}

            <Fact
              icon="user"
              label="Organizador"
              value={event.organizer_name}
              styles={styles}
              iconColor={colors.inkSecondary}
            />
          </View>

          {event.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sobre</Text>
              <Text style={styles.description}>{event.description}</Text>
            </View>
          ) : null}

          {event.is_organizer ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Organização</Text>
              {!canceled && (
                <AsButton
                  label="Editar evento"
                  icon="edit"
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: '/create-event', params: { eventId: event.id } })
                  }
                />
              )}
              <AsButton label="Chat do evento" icon="chat" variant="secondary" onPress={openChat} />
              <AsButton
                label="Sorteio de times"
                icon="shuffle"
                variant="secondary"
                onPress={openTeams}
              />
              {!canceled &&
                (confirmingCancel ? (
                  <AsConfirm
                    destructive
                    message="Cancelar o evento avisa todos os inscritos. Essa ação não pode ser desfeita."
                    cancelLabel="Voltar"
                    confirmLabel={actionLoading ? 'Cancelando...' : 'Sim, cancelar evento'}
                    loading={actionLoading}
                    onCancel={() => setConfirmingCancel(false)}
                    onConfirm={() =>
                      run('cancel', () =>
                        withAction(
                          () => api.updateEvent(accessToken!, event.id, { status: 'canceled' }),
                          'Evento cancelado. Os inscritos foram avisados.',
                        ),
                      ).then(() => setConfirmingCancel(false))
                    }
                  />
                ) : (
                  <AsButton
                    label="Cancelar evento"
                    icon="close"
                    variant="dangerGhost"
                    style={styles.alignStart}
                    onPress={() => setConfirmingCancel(true)}
                  />
                ))}
            </View>
          ) : (
            <View style={styles.section}>
              {event.is_participant && !myParticipation?.presence_confirmed && (
                <AsButton
                  label="Confirmar presença"
                  icon="check"
                  variant="secondary"
                  loading={pendingAction === 'presence'}
                  disabled={actionLoading}
                  onPress={() =>
                    run('presence', () =>
                      withAction(
                        () => api.confirmPresence(accessToken!, event.id),
                        'Presença confirmada. O organizador já vê isso na lista.',
                      ),
                    )
                  }
                />
              )}
              {event.is_participant && (
                <>
                  <AsButton label="Chat do evento" icon="chat" variant="secondary" onPress={openChat} />
                  <AsButton label="Ver times" icon="users" variant="secondary" onPress={openTeams} />
                </>
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Participantes ({event.participants.length})
            </Text>
            {event.participants.length === 0 && (
              <Text style={styles.emptyParticipants}>Ninguém inscrito ainda. Seja o primeiro.</Text>
            )}
            {event.participants.map((p) => (
              <View key={p.user_id} style={styles.participantRow}>
                <View style={styles.participantAvatar}>
                  <Text style={styles.participantInitials}>{initials(p.name || 'Participante')}</Text>
                </View>
                <Text style={styles.participantName} numberOfLines={1}>
                  {p.name || 'Participante'}
                </Text>
                {p.presence_confirmed && <AsBadge label="Presença confirmada" tone="primary" />}
              </View>
            ))}
          </View>
        </AsColumn>
      </ScrollView>

      {!event.is_organizer && (
        <SafeAreaView edges={['bottom']} style={styles.dock}>
          <AsColumn style={styles.dockColumn}>
            <AsButton
              label={
                event.is_participant ? 'Sair do evento' : full ? 'Evento lotado' : 'Participar'
              }
              variant={event.is_participant ? 'secondary' : 'primary'}
              block
              disabled={(!event.is_participant && full) || canceled || actionLoading}
              loading={pendingAction === 'join' || pendingAction === 'leave'}
              onPress={() =>
                event.is_participant
                  ? run('leave', () =>
                      withAction(
                        () => api.leaveEvent(accessToken!, event.id),
                        'Você saiu do evento e a vaga foi liberada.',
                      ),
                    )
                  : run('join', handleJoin)
              }
            />
          </AsColumn>
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
}

function Fact({
  icon,
  label,
  value,
  action,
  styles,
  iconColor,
}: {
  icon: IconName;
  label: string;
  value: string;
  action?: ReactNode;
  styles: ReturnType<typeof createStyles>;
  iconColor: string;
}) {
  return (
    <View style={styles.fact}>
      <AsIcon name={icon} size={20} color={iconColor} style={styles.factIcon} />
      <View style={styles.flex}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue}>{value}</Text>
      </View>
      {action}
    </View>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: DSColors.surface },
    flex: { flex: 1 },
    alignStart: { alignSelf: 'flex-start', paddingHorizontal: DSSpacing[2] },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    centeredPadded: { flex: 1, justifyContent: 'center', padding: DSSpacing[4] },
    content: { padding: DSSpacing[4], paddingBottom: DSSpacing[7] },
    column: { gap: DSSpacing[5] },
    hero: { gap: DSSpacing[2] },
    tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: DSSpacing[2] },
    sportDot: { width: 10, height: 10, borderRadius: 5 },
    sport: { ...DSType.labelStrong, color: DSColors.inkSecondary },
    title: { ...DSType.display, color: DSColors.ink },
    scoreboard: {
      flexDirection: 'row',
      borderRadius: DSRadius.md,
      backgroundColor: DSColors.surface2,
      padding: DSSpacing[4],
      gap: DSSpacing[4],
    },
    scoreCell: { flex: 1, gap: 2 },
    scoreDivider: { width: 1, backgroundColor: DSColors.lineStrong },
    scoreLabel: { ...DSType.meta, color: DSColors.inkSecondary },
    scoreValue: { ...DSType.display, color: DSColors.ink, fontVariant: ['tabular-nums'] },
    scoreValueSub: {
      ...DSType.scoreSm,
      fontSize: DSText.xl,
      color: DSColors.inkSecondary,
    },
    scoreSub: { ...DSType.label, color: DSColors.inkSecondary },
    slotsTrack: {
      height: 6,
      marginTop: DSSpacing[2],
      borderRadius: 3,
      backgroundColor: DSColors.line,
      overflow: 'hidden',
    },
    slotsFill: { height: '100%', borderRadius: 3, backgroundColor: DSColors.primary },
    slotsFillFull: { backgroundColor: DSColors.danger },
    facts: { gap: DSSpacing[3] },
    fact: { flexDirection: 'row', alignItems: 'flex-start', gap: DSSpacing[3] },
    factIcon: { marginTop: 2 },
    factLabel: { ...DSType.meta, color: DSColors.inkSecondary },
    factValue: { ...DSType.body, color: DSColors.ink },
    factAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 44,
      paddingHorizontal: DSSpacing[2],
    },
    factActionText: { ...DSType.labelStrong, color: DSColors.primary },
    editLocationBlock: { gap: DSSpacing[2] },
    rowButtons: { flexDirection: 'row', gap: DSSpacing[2] },
    section: { gap: DSSpacing[2] },
    sectionTitle: { ...DSType.labelStrong, color: DSColors.inkSecondary },
    description: { ...DSType.body, color: DSColors.ink },
    emptyParticipants: { ...DSType.small, color: DSColors.inkSecondary },
    participantRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DSSpacing[3],
      paddingVertical: DSSpacing[2],
      borderBottomWidth: 1,
      borderBottomColor: DSColors.line,
    },
    participantAvatar: {
      width: 36,
      height: 36,
      borderRadius: DSRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: DSColors.primaryTint,
    },
    participantInitials: { ...DSType.meta, fontWeight: '700', color: DSColors.primary },
    participantName: { ...DSType.label, flex: 1, color: DSColors.ink },
    dock: {
      paddingHorizontal: DSSpacing[4],
      paddingTop: DSSpacing[3],
      paddingBottom: DSSpacing[3],
      borderTopWidth: 1,
      borderTopColor: DSColors.line,
      backgroundColor: DSColors.surface,
    },
    dockColumn: { gap: DSSpacing[2] },
  });
}
