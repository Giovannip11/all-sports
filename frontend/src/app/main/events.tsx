import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsBadge } from '@/components/design-system/as-badge';
import { AsBanner } from '@/components/design-system/as-banner';
import { AsButton } from '@/components/design-system/as-button';
import { AsChip } from '@/components/design-system/as-chip';
import { AsEmpty } from '@/components/design-system/as-empty';
import { AsIconButton } from '@/components/design-system/as-icon-button';
import { AsColumn } from '@/components/design-system/as-layout';
import {
  BottomTabInset,
  DSRadius,
  DSSpacing,
  DSText,
  DSType,
  type DSColorSet,
} from '@/constants/design-system';
import { SPORT_TYPES, type SportKey } from '@/constants/discover';
import { ApiError, eventHref, type ApiEvent } from '@/lib/api';
import * as api from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { useDSColors } from '@/providers/theme-context';
import { DiscoveryFiltersPanel } from '@/components/discover/discovery-filters';
import { useUserLocation } from '@/hooks/use-user-location';
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  applyDiscovery,
  distanceKm,
  formatDistance,
  priorityMap,
  type DiscoveryFilters,
} from '@/utils/discovery';
import { dateParts } from '@/utils/format';

const SPORT_KEYS = Object.keys(SPORT_TYPES) as SportKey[];

export default function EventsScreen() {
  const { user, accessToken, mySports } = useAuth();
  const { region } = useUserLocation();
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sport, setSport] = useState<SportKey | null>(null);
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const extraFilters = activeFilterCount(filters);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionId, setActionId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

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

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleToggleJoin(event: ApiEvent) {
    if (!accessToken) return;
    setActionId(event.id);
    setNotice('');
    try {
      if (event.is_participant) {
        await api.leaveEvent(accessToken, event.id);
      } else {
        await api.joinEvent(accessToken, event.id);
      }
      await load();
      // UX-02: retorno explícito da ação, além do botão que muda de estado.
      setNotice(
        event.is_participant
          ? `Você saiu de "${event.title}".`
          : `Inscrição confirmada em "${event.title}".`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar a inscrição');
    } finally {
      setActionId(null);
    }
  }

  // Spinner de tela cheia só na primeira carga; recargas mantêm a lista visível.
  const firstLoad = loading && events.length === 0;
  // Data/horário/distância + esportes preferidos primeiro (DISC-03/DISC-04).
  const visible = useMemo(
    () => applyDiscovery(events, filters, region, priorityMap(mySports)),
    [events, filters, region, mySports],
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <AsColumn style={styles.headerColumn}>
          <View style={styles.headerRow}>
            <Text style={styles.title} accessibilityRole="header">
              Eventos
            </Text>
            {loading && !firstLoad && !refreshing && (
              <ActivityIndicator size="small" color={colors.primary} />
            )}
            <View style={styles.flex} />
            <AsIconButton
              icon="bell"
              label="Notificações"
              variant="tonal"
              badge={unreadCount}
              onPress={() => router.push('/notifications')}
            />
            {user?.role === 'organize' && (
              <AsButton
                label="Criar"
                icon="plus"
                size="sm"
                onPress={() => router.push('/create-event')}
                accessibilityLabel="Criar evento"
              />
            )}
          </View>
        </AsColumn>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}>
          <AsChip
            label={extraFilters ? `Filtros (${extraFilters})` : 'Filtros'}
            active={filtersOpen || extraFilters > 0}
            onPress={() => setFiltersOpen((open) => !open)}
          />
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
        {filtersOpen && (
          <AsColumn style={styles.headerColumn}>
            <DiscoveryFiltersPanel
              value={filters}
              onChange={setFilters}
              hasLocation={!!region}
              onClose={() => setFiltersOpen(false)}
            />
          </AsColumn>
        )}
      </SafeAreaView>

      {firstLoad ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: BottomTabInset + DSSpacing[6] }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }>
          <AsColumn style={styles.listColumn}>
            {error ? (
              <AsBanner
                tone="error"
                message={error}
                action={{ label: 'Tentar de novo', onPress: load }}
              />
            ) : null}
            {notice ? (
              <AsBanner
                tone="success"
                message={notice}
                action={{ label: 'Ok', onPress: () => setNotice('') }}
              />
            ) : null}

            {!loading && !error && events.length > 0 && visible.length === 0 && (
              <AsEmpty
                icon="filter"
                title="Nada com esses filtros"
                body="Tente outro dia, horário ou uma distância maior."
                action={{ label: 'Limpar filtros', onPress: () => setFilters(DEFAULT_FILTERS) }}
              />
            )}

            {!loading && !error && events.length === 0 && (
              <AsEmpty
                icon="calendar"
                title={sport ? `Nenhum evento de ${SPORT_TYPES[sport].label}` : 'Nenhum evento por aqui ainda'}
                body={
                  user?.role === 'organize'
                    ? 'Crie um racha e chame a galera.'
                    : sport
                      ? 'Tente outro esporte ou veja todos.'
                      : 'Quando alguém criar um racha perto de você, ele aparece aqui.'
                }
                action={
                  user?.role === 'organize'
                    ? { label: 'Criar evento', icon: 'plus', onPress: () => router.push('/create-event') }
                    : sport
                      ? { label: 'Ver todos', onPress: () => setSport(null) }
                      : undefined
                }
              />
            )}

            {visible.map((event) => {
              const sportInfo = SPORT_TYPES[event.sport as SportKey];
              const full = event.participants_count >= event.max_participants;
              const canceled = event.status === 'canceled';
              const when = dateParts(event.starts_at);
              const fill = Math.min(1, event.participants_count / Math.max(1, event.max_participants));
              // O card e o botão Participar/Sair são áreas de toque irmãs: um
              // botão dentro do outro vira <button> dentro de <button> na web
              // (HTML inválido, erro no console e clique ambíguo).
              return (
                <View key={event.id} style={styles.card}>
                  <View
                    style={[
                      styles.stripe,
                      { backgroundColor: sportInfo?.color ?? colors.inkTertiary },
                    ]}
                  />
                  <View style={styles.cardContent}>
                    <Pressable
                      style={({ pressed }) => [styles.cardMain, pressed && styles.cardPressed]}
                      onPress={() => router.push(eventHref(event))}
                      accessibilityRole="button"
                      accessibilityLabel={`${event.title}, ${event.location}, ${when.weekday} ${when.day} às ${when.time}, ${event.participants_count} de ${event.max_participants} vagas`}
                      accessibilityHint="Abre o evento">
                      <View style={styles.when}>
                        <Text style={styles.whenTime}>{when.time}</Text>
                        <Text style={styles.whenDay}>{when.day}</Text>
                        <Text style={styles.whenWeekday}>{when.weekday}</Text>
                      </View>
                      <View style={styles.cardBody}>
                        <View style={styles.cardTags}>
                          <Text style={styles.cardSport} numberOfLines={1}>
                            {sportInfo?.label ?? event.sport}
                          </Text>
                          {event.kind === 'tournament' && <AsBadge label="Torneio" tone="accent" />}
                          {canceled && <AsBadge label="Cancelado" tone="danger" />}
                          {!canceled && full && <AsBadge label="Lotado" tone="danger" />}
                          {event.visibility === 'private' && <AsBadge label="Privado" />}
                        </View>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {event.title}
                        </Text>
                        <Text style={styles.cardSubtitle} numberOfLines={1}>
                          {region ? `${formatDistance(distanceKm(region, event))} · ` : ''}
                          {event.location}
                        </Text>

                        <View style={styles.slots}>
                          <View style={styles.slotsTrack}>
                            <View
                              style={[
                                styles.slotsFill,
                                { width: `${fill * 100}%` as const },
                                full && styles.slotsFillFull,
                              ]}
                            />
                          </View>
                          <Text style={styles.slotsLabel}>
                            {event.participants_count}/{event.max_participants}
                          </Text>
                        </View>
                      </View>
                    </Pressable>

                    <View style={styles.cardFooter}>
                      {event.is_organizer ? (
                        <AsBadge label="Você organiza" tone="primary" />
                      ) : event.kind === 'tournament' ? (
                        // Torneio: a inscrição é por equipe, na tela do torneio.
                        <AsButton
                          size="sm"
                          variant="secondary"
                          label="Ver torneio"
                          icon="trophy"
                          onPress={() => router.push(eventHref(event))}
                          accessibilityLabel={`Ver torneio ${event.title}`}
                        />
                      ) : (
                        <AsButton
                          size="sm"
                          variant={event.is_participant || full || canceled ? 'secondary' : 'primary'}
                          label={event.is_participant ? 'Sair' : full ? 'Lotado' : 'Participar'}
                          loading={actionId === event.id}
                          disabled={
                            actionId === event.id ||
                            (!event.is_participant && full) ||
                            canceled
                          }
                          onPress={() => handleToggleJoin(event)}
                          accessibilityLabel={
                            event.is_participant
                              ? `Sair de ${event.title}`
                              : `Participar de ${event.title}`
                          }
                        />
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </AsColumn>
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: DSColors.bg,
    },
    flex: {
      flex: 1,
    },
    header: {
      backgroundColor: DSColors.surface,
      borderBottomWidth: 1,
      borderBottomColor: DSColors.line,
      paddingBottom: DSSpacing[3],
      gap: DSSpacing[2],
    },
    headerColumn: {
      paddingHorizontal: DSSpacing[4],
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DSSpacing[2],
      paddingTop: DSSpacing[2],
    },
    title: {
      ...DSType.title,
      color: DSColors.ink,
    },
    chipsRow: {
      paddingHorizontal: DSSpacing[4],
      gap: DSSpacing[2],
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: {
      padding: DSSpacing[4],
    },
    listColumn: {
      gap: DSSpacing[3],
    },
    card: {
      flexDirection: 'row',
      backgroundColor: DSColors.surface,
      borderRadius: DSRadius.md,
      borderWidth: 1,
      borderColor: DSColors.line,
      overflow: 'hidden',
    },
    cardContent: {
      flex: 1,
    },
    cardMain: {
      flexDirection: 'row',
    },
    cardPressed: {
      backgroundColor: DSColors.surface2,
    },
    stripe: {
      width: 6,
    },
    when: {
      width: 76,
      paddingVertical: DSSpacing[3],
      alignItems: 'center',
      borderRightWidth: 1,
      borderRightColor: DSColors.line,
    },
    whenTime: {
      ...DSType.score,
      color: DSColors.ink,
    },
    whenDay: {
      ...DSType.scoreSm,
      fontSize: DSText.md,
      color: DSColors.inkSecondary,
    },
    whenWeekday: {
      ...DSType.meta,
      color: DSColors.inkSecondary,
    },
    cardBody: {
      flex: 1,
      padding: DSSpacing[3],
      gap: 4,
    },
    cardTags: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    cardSport: {
      ...DSType.meta,
      color: DSColors.inkSecondary,
    },
    cardTitle: {
      ...DSType.bodyStrong,
      color: DSColors.ink,
    },
    cardSubtitle: {
      ...DSType.small,
      color: DSColors.inkSecondary,
    },
    slots: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DSSpacing[2],
      marginTop: DSSpacing[1],
    },
    slotsTrack: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: DSColors.surface2,
      overflow: 'hidden',
    },
    slotsFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: DSColors.primary,
    },
    slotsFillFull: {
      backgroundColor: DSColors.danger,
    },
    slotsLabel: {
      ...DSType.scoreSm,
      fontSize: DSText.md,
      color: DSColors.ink,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: DSSpacing[3],
      paddingBottom: DSSpacing[3],
    },
  });
}
