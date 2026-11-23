import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsChip } from '@/components/design-system/as-chip';
import { DSColors, DSRadius, DSSpacing, DSText } from '@/constants/design-system';
import { SPORT_TYPES, type SportKey } from '@/constants/discover';
import { BottomTabInset } from '@/constants/theme';
import { ApiError, type ApiEvent } from '@/lib/api';
import * as api from '@/lib/api';
import { useAuth } from '@/providers/auth-context';

const SPORT_KEYS = Object.keys(SPORT_TYPES) as SportKey[];

function formatDate(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EventsScreen() {
  const { user, accessToken } = useAuth();
  const [sport, setSport] = useState<SportKey | null>(null);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [eventList, notifications] = await Promise.all([
        api.listEvents(accessToken, sport ?? undefined),
        api.listNotifications(accessToken),
      ]);
      setEvents(eventList);
      setUnreadCount(notifications.filter((n) => !n.read).length);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  }, [accessToken, sport]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleToggleJoin(event: ApiEvent) {
    if (!accessToken) return;
    setActionId(event.id);
    try {
      if (event.is_participant) {
        await api.leaveEvent(accessToken, event.id);
      } else {
        await api.joinEvent(accessToken, event.id);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar a inscrição');
    } finally {
      setActionId(null);
    }
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Eventos</Text>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/notifications')}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Notificações">
              <Text style={styles.iconButtonText}>🔔</Text>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </Pressable>
            {user?.role === 'organize' && (
              <Pressable
                onPress={() => router.push('/create-event')}
                style={styles.createButton}
                accessibilityRole="button"
                accessibilityLabel="Criar evento">
                <Text style={styles.createButtonText}>+ Criar</Text>
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}>
          <AsChip label="Todos" active={sport === null} onPress={() => setSport(null)} />
          {SPORT_KEYS.map((key) => (
            <AsChip
              key={key}
              label={SPORT_TYPES[key].label}
              dotColor={SPORT_TYPES[key].color}
              active={sport === key}
              onPress={() => setSport((current) => (current === key ? null : key))}
            />
          ))}
        </ScrollView>
      </SafeAreaView>

      {error ? (
        <View style={styles.formError}>
          <Text style={styles.formErrorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={DSColors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: BottomTabInset + DSSpacing[6] }]}>
          {events.length === 0 && (
            <Text style={styles.empty}>Nenhum evento por aqui ainda.</Text>
          )}
          {events.map((event) => {
            const sportInfo = SPORT_TYPES[event.sport as SportKey];
            const full = event.participants_count >= event.max_participants;
            return (
              <Pressable
                key={event.id}
                style={styles.card}
                onPress={() => router.push(`/event/${event.id}`)}>
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.sportDot,
                      { backgroundColor: sportInfo?.color ?? DSColors.inkTertiary },
                    ]}
                  />
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {event.title}
                  </Text>
                  {event.visibility === 'private' && (
                    <View style={styles.privateBadge}>
                      <Text style={styles.privateBadgeText}>Privado</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardSubtitle} numberOfLines={1}>
                  {event.location} · {formatDate(event.starts_at)}
                </Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardMeta}>
                    {event.participants_count}/{event.max_participants} vagas
                    {event.status === 'canceled' ? ' · Cancelado' : ''}
                  </Text>
                  {event.is_organizer ? (
                    <View style={styles.organizerBadge}>
                      <Text style={styles.organizerBadgeText}>Você organiza</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => handleToggleJoin(event)}
                      disabled={actionId === event.id || (!event.is_participant && full) || event.status === 'canceled'}
                      style={[
                        styles.joinButton,
                        event.is_participant && styles.leaveButton,
                        (full && !event.is_participant) && styles.joinButtonDisabled,
                      ]}>
                      <Text
                        style={[
                          styles.joinButtonText,
                          event.is_participant && styles.leaveButtonText,
                        ]}>
                        {actionId === event.id
                          ? '...'
                          : event.is_participant
                            ? 'Sair'
                            : full
                              ? 'Lotado'
                              : 'Participar'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DSColors.surface2,
  },
  header: {
    backgroundColor: DSColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: DSColors.line,
    gap: DSSpacing[2],
    paddingBottom: DSSpacing[2],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DSSpacing[4],
    paddingTop: DSSpacing[2],
  },
  title: {
    fontSize: DSText.xl,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: DSColors.ink,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DSSpacing[2],
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.surface2,
  },
  iconButtonText: {
    fontSize: 16,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: DSColors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: DSColors.inverse,
  },
  createButton: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.accent,
  },
  createButtonText: {
    fontSize: DSText.sm,
    fontWeight: '800',
    color: DSColors.inverse,
  },
  chipsRow: {
    paddingHorizontal: DSSpacing[4],
    gap: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: DSSpacing[4],
    gap: DSSpacing[3],
  },
  empty: {
    textAlign: 'center',
    marginTop: DSSpacing[6],
    fontSize: DSText.sm,
    fontWeight: '600',
    color: DSColors.inkSecondary,
  },
  card: {
    backgroundColor: DSColors.surface,
    borderRadius: DSRadius.lg,
    borderWidth: 1,
    borderColor: DSColors.line,
    padding: DSSpacing[3],
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sportDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardTitle: {
    flex: 1,
    fontSize: DSText.md,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: DSColors.ink,
  },
  privateBadge: {
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.dangerTint,
  },
  privateBadgeText: {
    fontSize: DSText.xs,
    fontWeight: '800',
    color: DSColors.danger,
  },
  cardSubtitle: {
    fontSize: DSText.sm,
    fontWeight: '600',
    color: DSColors.inkSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardMeta: {
    fontSize: DSText.xs,
    fontWeight: '700',
    color: DSColors.inkSecondary,
  },
  organizerBadge: {
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.primaryTint,
  },
  organizerBadgeText: {
    fontSize: DSText.xs,
    fontWeight: '800',
    color: DSColors.primary,
  },
  joinButton: {
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.accent,
  },
  joinButtonDisabled: {
    backgroundColor: DSColors.lineStrong,
  },
  joinButtonText: {
    fontSize: DSText.xs,
    fontWeight: '800',
    color: DSColors.inverse,
  },
  leaveButton: {
    backgroundColor: DSColors.surface2,
    borderWidth: 1,
    borderColor: DSColors.lineStrong,
  },
  leaveButtonText: {
    color: DSColors.ink,
  },
  formError: {
    margin: DSSpacing[4],
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
});
