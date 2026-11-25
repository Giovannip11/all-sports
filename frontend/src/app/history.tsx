import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsBadge } from '@/components/design-system/as-badge';
import { AsBanner } from '@/components/design-system/as-banner';
import { AsChip } from '@/components/design-system/as-chip';
import { AsEmpty } from '@/components/design-system/as-empty';
import { AsHeader } from '@/components/design-system/as-header';
import { AsColumn } from '@/components/design-system/as-layout';
import { AsSegmented } from '@/components/design-system/as-segmented';
import { DSRadius, DSSpacing, DSText, DSType, type DSColorSet } from '@/constants/design-system';
import { SPORT_TYPES, type SportKey } from '@/constants/discover';
import { ApiError, type ApiEvent } from '@/lib/api';
import * as api from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { useDSColors } from '@/providers/theme-context';
import { dateParts } from '@/utils/format';

type Period = 'past' | 'upcoming';

const SPORT_KEYS = Object.keys(SPORT_TYPES) as SportKey[];

const STATUS_LABEL: Partial<Record<ApiEvent['status'], string>> = {
  canceled: 'Cancelado',
  finished: 'Encerrado',
  in_progress: 'Acontecendo',
};

/**
 * EVENT-09 / RF04 — eventos em que a pessoa se inscreveu, separados entre os
 * que já aconteceram e os próximos, com filtro por esporte.
 */
export default function HistoryScreen() {
  const { accessToken } = useAuth();
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<Period>('past');
  const [sport, setSport] = useState<SportKey | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      setEvents(await api.myEventHistory(accessToken));
      // Referência de "agora" fixada na carga, para o render ficar puro.
      setLoadedAt(Date.now());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar seu histórico');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isPast = useCallback(
    (e: ApiEvent) => new Date(e.starts_at).getTime() < loadedAt || e.status === 'finished',
    [loadedAt],
  );

  const visible = useMemo(() => {
    return events
      .filter((e) => (period === 'past' ? isPast(e) : !isPast(e)))
      .filter((e) => !sport || e.sport === sport)
      .sort((a, b) =>
        period === 'past'
          ? b.starts_at.localeCompare(a.starts_at)
          : a.starts_at.localeCompare(b.starts_at),
      );
  }, [events, period, sport, isPast]);

  const pastCount = events.filter(isPast).length;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AsHeader title="Meus eventos" bordered />

      <View style={styles.filters}>
        <AsColumn style={styles.filtersColumn}>
          <AsSegmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'past', label: `Já joguei (${pastCount})` },
              { value: 'upcoming', label: `Próximos (${events.length - pastCount})` },
            ]}
          />
        </AsColumn>
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
      </View>

      {loading && events.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Carregando seus eventos...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <AsColumn style={styles.list}>
            {error ? (
              <AsBanner tone="error" message={error} action={{ label: 'Tentar de novo', onPress: load }} />
            ) : null}

            {!error && visible.length === 0 && (
              <AsEmpty
                icon="calendar"
                title={
                  period === 'past'
                    ? 'Nenhum evento jogado ainda'
                    : 'Nenhum evento marcado'
                }
                body={
                  sport
                    ? `Nada de ${SPORT_TYPES[sport].label} aqui. Tente outro esporte.`
                    : 'Quando você participar de um racha, ele aparece aqui.'
                }
                action={{ label: 'Procurar eventos', icon: 'search', onPress: () => router.push('/main/events') }}
              />
            )}

            {visible.map((event) => {
              const info = SPORT_TYPES[event.sport as SportKey];
              const when = dateParts(event.starts_at);
              const statusLabel = STATUS_LABEL[event.status];
              return (
                <Pressable
                  key={event.id}
                  onPress={() => router.push(api.eventHref(event))}
                  accessibilityRole="button"
                  accessibilityLabel={`${event.title}, ${info?.label ?? event.sport}, ${event.location}, ${when.weekday} ${when.day} às ${when.time}${statusLabel ? `, ${statusLabel}` : ''}`}
                  accessibilityHint="Abre o evento"
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                  <View style={[styles.stripe, { backgroundColor: info?.color ?? colors.inkTertiary }]} />
                  <View style={styles.when}>
                    <Text style={styles.whenDay}>{when.day}</Text>
                    <Text style={styles.whenMeta}>
                      {when.weekday} {when.time}
                    </Text>
                  </View>
                  <View style={styles.body}>
                    <View style={styles.tags}>
                      <Text style={styles.sport}>{info?.label ?? event.sport}</Text>
                      {statusLabel ? (
                        <AsBadge
                          label={statusLabel}
                          tone={event.status === 'canceled' ? 'danger' : 'neutral'}
                        />
                      ) : null}
                    </View>
                    <Text style={styles.title} numberOfLines={2}>
                      {event.title}
                    </Text>
                    <Text style={styles.location} numberOfLines={1}>
                      {event.location} · {event.organizer_name || 'Organizador'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </AsColumn>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: DSColors.bg },
    filters: {
      backgroundColor: DSColors.surface,
      borderBottomWidth: 1,
      borderBottomColor: DSColors.line,
      paddingVertical: DSSpacing[3],
      gap: DSSpacing[3],
    },
    filtersColumn: { paddingHorizontal: DSSpacing[4] },
    chipsRow: { paddingHorizontal: DSSpacing[4], gap: DSSpacing[2] },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: DSSpacing[2] },
    loadingText: { ...DSType.small, color: DSColors.inkSecondary },
    content: { padding: DSSpacing[4], paddingBottom: DSSpacing[7] },
    list: { gap: DSSpacing[3] },
    card: {
      flexDirection: 'row',
      backgroundColor: DSColors.surface,
      borderRadius: DSRadius.md,
      borderWidth: 1,
      borderColor: DSColors.line,
      overflow: 'hidden',
    },
    cardPressed: { backgroundColor: DSColors.surface2 },
    stripe: { width: 6 },
    when: {
      width: 84,
      paddingVertical: DSSpacing[3],
      alignItems: 'center',
      justifyContent: 'center',
      borderRightWidth: 1,
      borderRightColor: DSColors.line,
    },
    whenDay: { ...DSType.score, color: DSColors.ink },
    whenMeta: { ...DSType.meta, color: DSColors.inkSecondary },
    body: { flex: 1, padding: DSSpacing[3], gap: 4 },
    tags: { flexDirection: 'row', alignItems: 'center', gap: DSSpacing[2], flexWrap: 'wrap' },
    sport: { ...DSType.meta, color: DSColors.inkSecondary },
    title: { ...DSType.bodyStrong, color: DSColors.ink },
    location: { ...DSType.small, fontSize: DSText.sm, color: DSColors.inkSecondary },
  });
}
