import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { AsButton } from '@/components/design-system/as-button';
import { AsIcon } from '@/components/design-system/as-icon';
import { DiscoverOverlay } from '@/components/discover/discover-overlay';
import { MarkerPin } from '@/components/discover/marker-pin';
import { DSSpacing, DSType, type DSColorSet } from '@/constants/design-system';
import { SPORT_TYPES, type SportKey } from '@/constants/discover';
import { useUserLocation } from '@/hooks/use-user-location';
import { ApiError, type ApiMapMarker } from '@/lib/api';
import * as api from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { useDSColors } from '@/providers/theme-context';
import {
  DEFAULT_FILTERS,
  applyDiscovery,
  priorityMap,
  type DiscoveryFilters,
} from '@/utils/discovery';

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export default function DiscoverScreen() {
  const { user, accessToken, mySports } = useAuth();
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_FILTERS);
  const { region, status } = useUserLocation();
  const DSColors = useDSColors();
  const styles = useMemo(() => createStyles(DSColors), [DSColors]);
  const [activeSports, setActiveSports] = useState<SportKey[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [allMarkers, setAllMarkers] = useState<ApiMapMarker[]>([]);
  const [loadingMarkers, setLoadingMarkers] = useState(true);
  const [loadError, setLoadError] = useState('');
  const mapRef = useRef<MapView>(null);
  const [sheetHeight, setSheetHeight] = useState(0);

  const loadMarkers = useCallback(async () => {
    if (!accessToken) {
      setLoadingMarkers(false);
      return;
    }
    setLoadingMarkers(true);
    try {
      setAllMarkers(await api.listMapMarkers(accessToken));
      setLoadError('');
    } catch (err) {
      // Keep whatever markers were already loaded — the map still works,
      // just without the latest refresh.
      setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar os eventos');
    } finally {
      setLoadingMarkers(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      loadMarkers();
    }, [loadMarkers]),
  );

  function toggleSport(sport: SportKey) {
    setActiveSports((current) =>
      current.includes(sport) ? current.filter((s) => s !== sport) : [...current, sport],
    );
  }

  const markers = useMemo(() => {
    const term = normalize(query.trim());
    const matching = allMarkers.filter((marker) => {
      if (activeSports.length > 0 && !activeSports.includes(marker.sport as SportKey)) {
        return false;
      }
      if (!term) return true;
      const sportLabel = SPORT_TYPES[marker.sport as SportKey]?.label ?? marker.sport;
      const haystack = normalize(`${marker.title} ${marker.location} ${sportLabel}`);
      return haystack.includes(term);
    });
    // Data/horário/distância + esportes preferidos primeiro (DISC-03/DISC-04).
    return applyDiscovery(matching, filters, region, priorityMap(mySports));
  }, [activeSports, allMarkers, query, filters, region, mySports]);

  function focusMarker(id: string) {
    setSelectedId(id);
    const marker = markers.find((m) => m.id === id);
    if (!marker || !region) return;
    mapRef.current?.animateToRegion(
      {
        latitude: marker.latitude,
        longitude: marker.longitude,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      },
      300,
    );
  }

  return (
    <View style={styles.screen}>
      {region ? (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          // Centro e "minha localização" ficam na área visível, acima da sheet.
          mapPadding={{ top: 0, right: 0, left: 0, bottom: sheetHeight }}
          showsUserLocation
          showsMyLocationButton
          onPress={() => setSelectedId(null)}>
          {markers.map((marker) => {
            const sportInfo = SPORT_TYPES[marker.sport as SportKey];
            return (
              <Marker
                key={marker.id}
                coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                title={marker.title}
                description={marker.location}
                onPress={() => setSelectedId(marker.id)}>
                <MarkerPin
                  color={sportInfo?.color ?? DSColors.inkTertiary}
                  label={(sportInfo?.label ?? marker.sport).charAt(0)}
                  dashed={marker.visibility === 'private'}
                  selected={selectedId === marker.id}
                />
              </Marker>
            );
          })}
        </MapView>
      ) : (
        <View style={[styles.mapFallback, { bottom: sheetHeight }]}>
          {status === 'loading' && (
            <>
              <ActivityIndicator color={DSColors.primary} />
              <Text style={styles.fallbackBody}>Procurando sua localização...</Text>
            </>
          )}
          {status === 'denied' && (
            <>
              <View style={styles.fallbackIcon}>
                <AsIcon name="locate" size={24} color={DSColors.primary} />
              </View>
              <Text style={styles.fallbackTitle}>Precisamos da sua localização</Text>
              <Text style={styles.fallbackBody}>
                Ative a permissão de localização para ver o mapa da sua região.
              </Text>
              <AsButton
                label="Abrir configurações"
                variant="primary"
                onPress={() => Linking.openSettings()}
                style={styles.fallbackButton}
              />
            </>
          )}
          {status === 'error' && (
            <>
              <View style={styles.fallbackIcon}>
                <AsIcon name="alert" size={24} color={DSColors.danger} />
              </View>
              <Text style={styles.fallbackBody}>Não foi possível obter sua localização.</Text>
            </>
          )}
        </View>
      )}

      <DiscoverOverlay
        user={user}
        searchInput={
          <TextInput
            style={styles.searchInput}
            placeholder="Esporte, local ou racha"
            placeholderTextColor={DSColors.inkSecondary}
            accessibilityLabel="Buscar eventos"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
        }
        activeSports={activeSports}
        onToggleSport={toggleSport}
        hasQuery={query.trim().length > 0}
        markers={markers}
        totalMarkers={allMarkers.length}
        loading={loadingMarkers}
        loadError={loadError}
        onRetry={loadMarkers}
        selectedId={selectedId}
        onFocusMarker={focusMarker}
        onSheetHeight={setSheetHeight}
        filters={filters}
        onFiltersChange={setFilters}
        origin={region}
      />
    </View>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: DSColors.surface2,
    },
    mapFallback: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      gap: DSSpacing[2],
      padding: DSSpacing[6],
    },
    fallbackIcon: {
      width: 56,
      height: 56,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: DSColors.surface,
      marginBottom: DSSpacing[1],
    },
    fallbackTitle: {
      ...DSType.headline,
      color: DSColors.ink,
      textAlign: 'center',
    },
    fallbackBody: {
      ...DSType.small,
      color: DSColors.inkSecondary,
      textAlign: 'center',
      maxWidth: 320,
    },
    fallbackButton: {
      marginTop: DSSpacing[2],
    },
    searchInput: {
      ...DSType.body,
      flex: 1,
      height: '100%',
      color: DSColors.ink,
    },
  });
}
