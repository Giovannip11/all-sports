import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsButton } from '@/components/design-system/as-button';
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
  const { accessToken } = useAuth();
  const [event, setEvent] = useState<ApiEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

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
  const myParticipation = event.participants.find((p) => p.status === 'confirmed' && event.is_participant);

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
          {event.status === 'cancelled' ? ' · Cancelado' : ''}
        </Text>

        {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Local</Text>
          <Text style={styles.infoValue}>{event.location}</Text>
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
          event.status !== 'cancelled' && (
            <AsButton
              label={actionLoading ? 'Cancelando...' : 'Cancelar evento'}
              variant="secondary"
              loading={actionLoading}
              onPress={() =>
                withAction(() => api.updateEvent(accessToken!, event.id, { status: 'cancelled' }))
              }
            />
          )
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
              disabled={(!event.is_participant && full) || event.status === 'cancelled'}
              loading={actionLoading}
              onPress={() =>
                withAction(() =>
                  event.is_participant
                    ? api.leaveEvent(accessToken!, event.id)
                    : api.joinEvent(accessToken!, event.id),
                )
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
  infoLabel: { fontSize: DSText.xs, fontWeight: '800', color: DSColors.inkSecondary },
  infoValue: { fontSize: DSText.md, fontWeight: '600', color: DSColors.ink },
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
