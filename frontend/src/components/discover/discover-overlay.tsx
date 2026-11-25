import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsBadge } from '@/components/design-system/as-badge';
import { AsBanner } from '@/components/design-system/as-banner';
import { AsChip } from '@/components/design-system/as-chip';
import { AsIcon } from '@/components/design-system/as-icon';
import { AsIconButton } from '@/components/design-system/as-icon-button';
import {
  BottomTabInset,
  DSFonts,
  DSLayout,
  DSRadius,
  DSShadow1,
  DSSpacing,
  DSText,
  DSType,
  type DSColorSet,
} from '@/constants/design-system';
import { SPORT_TYPES, type SportKey } from '@/constants/discover';
import { eventHref, type ApiMapMarker, type ApiUser } from '@/lib/api';
import { useDSColors } from '@/providers/theme-context';
import {
  activeFilterCount,
  distanceKm,
  formatDistance,
  type DiscoveryFilters,
} from '@/utils/discovery';
import { dateParts, initials } from '@/utils/format';

import { DiscoveryFiltersPanel } from './discovery-filters';

const SPORT_KEYS = Object.keys(SPORT_TYPES) as SportKey[];

export type DiscoverOverlayProps = {
  user: ApiUser | null;
  /** Campo de busca — cada plataforma injeta o seu (TextInput no nativo, <input> na web). */
  searchInput: ReactNode;
  activeSports: SportKey[];
  onToggleSport: (sport: SportKey) => void;
  hasQuery: boolean;
  markers: ApiMapMarker[];
  totalMarkers: number;
  loading: boolean;
  loadError: string;
  onRetry: () => void;
  selectedId: string | null;
  /** Primeiro toque no card: centraliza o pin no mapa. */
  onFocusMarker: (id: string) => void;
  /** Altura da "sheet" inferior, para o mapa não ficar escondido atrás dela. */
  onSheetHeight?: (height: number) => void;
  /** Filtros de data, horário e distância (DISC-03). */
  filters: DiscoveryFilters;
  onFiltersChange: (next: DiscoveryFilters) => void;
  /** Posição do usuário, para mostrar a distância e filtrar por raio. */
  origin: { latitude: number; longitude: number } | null;
};

/**
 * Camada sobre o mapa (busca, filtros por esporte e a "sheet" de eventos
 * próximos), compartilhada entre o mapa nativo e o Leaflet da web.
 */
export function DiscoverOverlay({
  user,
  searchInput,
  activeSports,
  onToggleSport,
  hasQuery,
  markers,
  totalMarkers,
  loading,
  loadError,
  onRetry,
  selectedId,
  onFocusMarker,
  onSheetHeight,
  filters,
  onFiltersChange,
  origin,
}: DiscoverOverlayProps) {
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const extraFilters = activeFilterCount(filters);
  const filtering = hasQuery || activeSports.length > 0 || extraFilters > 0;

  function handleCardPress(id: string) {
    // Segundo toque no card já selecionado abre o evento.
    if (selectedId === id) {
      const marker = markers.find((m) => m.id === id);
      router.push(eventHref({ id, kind: marker?.kind }));
      return;
    }
    onFocusMarker(id);
  }

  return (
    <>
      <SafeAreaView edges={['top']} style={styles.floatHead} pointerEvents="box-none">
        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <AsIcon name="search" size={20} color={colors.inkSecondary} />
            {searchInput}
            {user?.role === 'organize' && (
              <AsIconButton
                icon="plus"
                label="Criar evento"
                variant="primary"
                onPress={() => router.push('/create-event')}
                style={styles.searchAction}
              />
            )}
            <Pressable
              onPress={() => router.push('/main/profile')}
              style={styles.avatar}
              accessibilityRole="button"
              accessibilityLabel="Abrir perfil">
              <Text style={styles.avatarText}>{initials(user?.name ?? '')}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}>
          <AsChip
            label={extraFilters ? `Filtros (${extraFilters})` : 'Filtros'}
            active={filtersOpen || extraFilters > 0}
            onPress={() => setFiltersOpen((open) => !open)}
          />
          {SPORT_KEYS.map((key) => (
            <AsChip
              key={key}
              label={SPORT_TYPES[key].label}
              dotColor={SPORT_TYPES[key].color}
              active={activeSports.includes(key)}
              onPress={() => onToggleSport(key)}
            />
          ))}
        </ScrollView>

        {filtersOpen && (
          <View style={styles.searchWrap}>
            <View style={styles.filtersPanel}>
              <DiscoveryFiltersPanel
                value={filters}
                onChange={onFiltersChange}
                hasLocation={!!origin}
                onClose={() => setFiltersOpen(false)}
                floating
              />
            </View>
          </View>
        )}
      </SafeAreaView>

      <View
        style={[styles.sheet, { paddingBottom: BottomTabInset + DSSpacing[3] }]}
        onLayout={(e) => onSheetHeight?.(Math.round(e.nativeEvent.layout.height))}
        pointerEvents="box-none">
        <View style={styles.handle} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            Perto de você
          </Text>
          {!loading && totalMarkers > 0 && (
            <Text style={styles.sheetCount}>
              {markers.length} {markers.length === 1 ? 'evento' : 'eventos'}
            </Text>
          )}
        </View>

        {loadError ? (
          <AsBanner
            tone="error"
            message={loadError}
            action={{ label: 'Tentar de novo', onPress: onRetry }}
            style={styles.sheetBanner}
          />
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cards}>
          {loading && markers.length === 0 && (
            <View style={styles.sheetState}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.sheetStateText}>Buscando eventos perto de você...</Text>
            </View>
          )}
          {!loading && markers.length === 0 && (
            <View style={styles.sheetState}>
              <Text style={styles.sheetStateTitle}>
                {filtering ? 'Nada com esses filtros' : 'Nenhum evento por aqui ainda'}
              </Text>
              <Text style={styles.sheetStateText}>
                {filtering
                  ? 'Tire um filtro ou busque outro esporte ou local.'
                  : user?.role === 'organize'
                    ? 'Crie o primeiro racha da região no botão +.'
                    : 'Volte mais tarde ou procure em outra região do mapa.'}
              </Text>
            </View>
          )}
          {markers.map((marker) => {
            const sportInfo = SPORT_TYPES[marker.sport as SportKey];
            const full = marker.participants_count >= marker.max_participants;
            const selected = selectedId === marker.id;
            const when = dateParts(marker.starts_at);
            return (
              <Pressable
                key={marker.id}
                onPress={() => handleCardPress(marker.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${marker.title}, ${marker.location}, ${when.weekday} ${when.day} às ${when.time}`}
                accessibilityHint={selected ? 'Abre o evento' : 'Mostra o evento no mapa'}
                style={[styles.card, selected && styles.cardSelected]}>
                <View
                  style={[
                    styles.cardStripe,
                    { backgroundColor: sportInfo?.color ?? colors.inkTertiary },
                  ]}
                />
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardSport} numberOfLines={1}>
                      {sportInfo?.label ?? marker.sport}
                    </Text>
                    {marker.kind === 'tournament' ? (
                      <AsBadge label="Torneio" tone="accent" />
                    ) : marker.visibility === 'private' ? (
                      <AsBadge label="Privado" tone="neutral" />
                    ) : full ? (
                      <AsBadge label="Lotado" tone="danger" />
                    ) : null}
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {marker.title}
                  </Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1}>
                    {origin ? `${formatDistance(distanceKm(origin, marker))} · ` : ''}
                    {marker.location}
                  </Text>
                  <View style={styles.cardScore}>
                    <Text style={styles.cardScoreMain}>{when.time}</Text>
                    <Text style={styles.cardScoreSub}>
                      {when.weekday} {when.day}
                    </Text>
                    <View style={styles.flex} />
                    <Text style={styles.cardScoreSub}>
                      {marker.participants_count}/{marker.max_participants}
                    </Text>
                  </View>
                  {selected && (
                    <View style={styles.cardOpen}>
                      <Text style={styles.cardOpenText}>Toque de novo para abrir</Text>
                      <AsIcon name="forward" size={16} color={colors.primary} />
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    floatHead: {
      gap: DSSpacing[2],
      paddingTop: DSSpacing[2],
      paddingBottom: DSSpacing[2],
    },
    searchWrap: {
      paddingHorizontal: DSSpacing[4],
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DSSpacing[2],
      height: 56,
      width: '100%',
      maxWidth: DSLayout.maxContent,
      alignSelf: 'center',
      paddingLeft: DSSpacing[4],
      paddingRight: 6,
      borderRadius: DSRadius.md,
      backgroundColor: DSColors.surface,
      ...DSShadow1,
    },
    searchAction: {
      width: DSLayout.touch,
      height: DSLayout.touch,
    },
    avatar: {
      width: DSLayout.touch,
      height: DSLayout.touch,
      borderRadius: DSRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: DSColors.primaryTint,
    },
    avatarText: {
      ...DSType.labelStrong,
      color: DSColors.primary,
    },
    chipsRow: {
      paddingHorizontal: DSSpacing[4],
      gap: DSSpacing[2],
    },
    filtersPanel: {
      width: '100%',
      maxWidth: DSLayout.maxContent,
      alignSelf: 'center',
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: DSColors.surface,
      borderTopLeftRadius: DSRadius.lg,
      borderTopRightRadius: DSRadius.lg,
      ...DSShadow1,
      shadowOffset: { width: 0, height: -2 },
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: DSRadius.pill,
      backgroundColor: DSColors.lineStrong,
      marginTop: DSSpacing[2],
      marginBottom: DSSpacing[1],
    },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: DSSpacing[4],
      marginBottom: DSSpacing[2],
    },
    sheetTitle: {
      fontFamily: DSFonts.display,
      fontSize: DSText.xl,
      lineHeight: 28,
      color: DSColors.ink,
    },
    sheetCount: {
      ...DSType.meta,
      color: DSColors.inkSecondary,
    },
    sheetBanner: {
      marginHorizontal: DSSpacing[4],
      marginBottom: DSSpacing[2],
    },
    sheetState: {
      width: 280,
      minHeight: 120,
      justifyContent: 'center',
      gap: DSSpacing[1],
    },
    sheetStateTitle: {
      ...DSType.bodyStrong,
      color: DSColors.ink,
    },
    sheetStateText: {
      ...DSType.small,
      color: DSColors.inkSecondary,
    },
    cards: {
      paddingHorizontal: DSSpacing[4],
      gap: DSSpacing[3],
    },
    card: {
      width: 232,
      flexDirection: 'row',
      borderRadius: DSRadius.md,
      overflow: 'hidden',
      backgroundColor: DSColors.surface,
      borderWidth: 1,
      borderColor: DSColors.line,
    },
    cardSelected: {
      borderColor: DSColors.primary,
      borderWidth: 2,
    },
    cardStripe: {
      width: 6,
    },
    cardBody: {
      flex: 1,
      paddingVertical: DSSpacing[3],
      paddingHorizontal: DSSpacing[3],
      gap: 2,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: DSSpacing[2],
      minHeight: 24,
    },
    cardSport: {
      ...DSType.meta,
      flexShrink: 1,
      color: DSColors.inkSecondary,
    },
    cardTitle: {
      ...DSType.bodyStrong,
      color: DSColors.ink,
    },
    cardSubtitle: {
      ...DSType.meta,
      color: DSColors.inkSecondary,
    },
    cardScore: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: DSSpacing[2],
      marginTop: DSSpacing[2],
    },
    cardScoreMain: {
      ...DSType.score,
      color: DSColors.ink,
    },
    cardScoreSub: {
      ...DSType.scoreSm,
      fontSize: DSText.md,
      color: DSColors.inkSecondary,
    },
    cardOpen: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginTop: DSSpacing[1],
    },
    cardOpenText: {
      ...DSType.meta,
      fontWeight: '700',
      color: DSColors.primary,
    },
  });
}
