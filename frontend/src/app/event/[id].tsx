import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsButton } from '@/components/design-system/as-button';
import { LocationPicker } from '@/components/location-picker';
import { DSColors, DSSpacing, DSText } from '@/constants/design-system';
import { SPORT_TYPES, type SportKey } from '@/constants/discover';
import { ApiError, type ApiEventDetail } from '@/lib/api';
import * as api from '@/lib/api';
import { useAuth } from '@/providers/auth-context';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken, user } = useAuth();
  const [event, setEvent] = useState<ApiEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingLocation, setEditingLocation] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const detail = await api.getEvent(accessToken, id);
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o local');
    } finally {
      setSavingLocation(false);
    }
  }

  async function handleJoin() {
    if (!accessToken || !event) return;
    setActionLoading(true);
    setError('');
    try {
      await api.joinEvent(accessToken, event.id);
      router.replace('/main/events');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível confirmar a participação');
      setActionLoading(false);
    }
  }

  async function withAction(fn: () => Promise<unknown>) {
    setActionLoading(true);
    setError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível completar a ação');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={DSColors.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
            <Text style={styles.backLabel}>‹</Text>
          </Pressable>
        </View>
        <View style={styles.centered}>
          <Text style={styles.formErrorText}>{error || 'Evento não encontrado'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sportInfo = SPORT_TYPES[event.sport as SportKey];
  const full = event.participants_count >= event.max_participants;
  const myParticipation = event.participants.find((p) => p.user_id === user?.id);

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
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.formError}>
            <Text style={styles.formErrorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.titleRow}>
          <View
            style={[styles.sportDot, { backgroundColor: sportInfo?.color ?? DSColors.inkTertiary }]}
          />
          <Text style={styles.title}>{event.title}</Text>
        </View>
        <Text style={styles.subtitle}>
          {sportInfo?.label ?? event.sport} · {event.visibility === 'private' ? 'Privado' : 'Público'}
          {event.status === 'canceled' ? ' · Cancelado' : ''}
        </Text>

        {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

        <View style={styles.infoBlock}>
          <View style={styles.infoLabelRow}>
            <Text style={styles.infoLabel}>Local</Text>
            {event.is_organizer && event.status !== 'canceled' && !editingLocation && (
              <Pressable
                onPress={() => {
                  setPendingCoords({ latitude: event.latitude, longitude: event.longitude });
                  setEditingLocation(true);
                }}
                hitSlop={8}>
                <Text style={styles.editLocationLink}>Editar local</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.infoValue}>{event.location}</Text>

          {editingLocation && pendingCoords && (
            <View style={styles.editLocationBlock}>
              <LocationPicker
                latitude={pendingCoords.latitude}
                longitude={pendingCoords.longitude}
                onChange={(latitude, longitude) => setPendingCoords({ latitude, longitude })}
              />
              <View style={styles.editLocationActions}>
                <AsButton
                  label="Cancelar"
                  variant="secondary"
                  style={styles.editLocationButton}
                  disabled={savingLocation}
                  onPress={() => setEditingLocation(false)}
                />
                <AsButton
                  label={savingLocation ? 'Salvando...' : 'Salvar local'}
                  variant="primary"
                  style={styles.editLocationButton}
                  loading={savingLocation}
                  onPress={handleSaveLocation}
                />
              </View>
            </View>
          )}
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Quando</Text>
          <Text style={styles.infoValue}>{formatDate(event.starts_at)}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Organizador</Text>
          <Text style={styles.infoValue}>{event.organizer_name}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Vagas</Text>
          <Text style={styles.infoValue}>
            {event.participants_count} de {event.max_participants}
          </Text>
        </View>

        {event.is_organizer ? (
          <View style={styles.actions}>
            <AsButton
              label="Chat do evento"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/event-chat',
                  params: { eventId: event.id, title: event.title },
                })
              }
            />
            <AsButton
              label="Sorteio de times"
              variant="secondary"
              onPress={() =>
                router.push({ pathname: '/team-draw', params: { eventId: event.id } })
              }
            />
            {event.status !== 'canceled' && (
              <AsButton
                label={actionLoading ? 'Cancelando...' : 'Cancelar evento'}
                variant="secondary"
                loading={actionLoading}
                onPress={() =>
                  withAction(() => api.updateEvent(accessToken!, event.id, { status: 'canceled' }))
                }
              />
            )}
          </View>
        ) : (
          <View style={styles.actions}>
            <AsButton
              label={
                actionLoading
                  ? '...'
                  : event.is_participant
                    ? 'Sair do evento'
                    : full
                      ? 'Evento lotado'
                      : 'Participar'
              }
              variant={event.is_participant ? 'secondary' : 'primary'}
              disabled={(!event.is_participant && full) || event.status === 'canceled'}
              loading={actionLoading}
              onPress={() =>
                event.is_participant
                  ? withAction(() => api.leaveEvent(accessToken!, event.id))
                  : handleJoin()
              }
            />
            {event.is_participant && !myParticipation?.presence_confirmed && (
              <AsButton
                label="Confirmar presença"
                variant="secondary"
                loading={actionLoading}
                onPress={() => withAction(() => api.confirmPresence(accessToken!, event.id))}
              />
            )}
            {event.is_participant && (
              <>
                <AsButton
                  label="Chat do evento"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/event-chat',
                      params: { eventId: event.id, title: event.title },
                    })
                  }
                />
                <AsButton
                  label="Ver times"
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: '/team-draw', params: { eventId: event.id } })
                  }
                />
              </>
            )}
          </View>
        )}

        <View style={styles.participantsBlock}>
          <Text style={styles.infoLabel}>Participantes</Text>
          {event.participants.length === 0 && (
            <Text style={styles.emptyParticipants}>Ninguém inscrito ainda.</Text>
          )}
          {event.participants.map((p) => (
            <View key={p.user_id} style={styles.participantRow}>
              <Text style={styles.participantName}>{p.name || 'Participante'}</Text>
              {p.presence_confirmed && <Text style={styles.presenceTag}>Presença confirmada</Text>}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DSColors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  backLabel: { fontSize: 24, fontWeight: '800', color: DSColors.ink },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { gap: DSSpacing[3], padding: DSSpacing[4] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sportDot: { width: 12, height: 12, borderRadius: 6 },
  title: { fontSize: DSText.xl, fontWeight: '800', letterSpacing: -0.5, color: DSColors.ink },
  subtitle: { fontSize: DSText.sm, fontWeight: '700', color: DSColors.inkSecondary },
  description: { fontSize: DSText.md, lineHeight: 21, color: DSColors.ink },
  infoBlock: { gap: 2 },
  infoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLabel: { fontSize: DSText.xs, fontWeight: '800', color: DSColors.inkSecondary },
  infoValue: { fontSize: DSText.md, fontWeight: '600', color: DSColors.ink },
  editLocationLink: { fontSize: DSText.xs, fontWeight: '800', color: DSColors.primary },
  editLocationBlock: { marginTop: DSSpacing[2], gap: DSSpacing[2] },
  editLocationActions: { flexDirection: 'row', gap: DSSpacing[2] },
  editLocationButton: { flex: 1 },
  actions: { gap: DSSpacing[2] },
  participantsBlock: { gap: 8, marginTop: DSSpacing[2] },
  emptyParticipants: { fontSize: DSText.sm, fontWeight: '600', color: DSColors.inkSecondary },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: DSColors.line,
  },
  participantName: { fontSize: DSText.sm, fontWeight: '700', color: DSColors.ink },
  presenceTag: { fontSize: DSText.xs, fontWeight: '800', color: DSColors.primary },
  formError: { padding: 12, borderRadius: 8, backgroundColor: DSColors.dangerTint },
  formErrorText: {
    fontSize: DSText.sm,
    fontWeight: '700',
    color: DSColors.danger,
    textAlign: 'center',
  },
});
