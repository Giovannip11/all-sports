import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';

import { AsChip } from '@/components/design-system/as-chip';
import { MarkerPin } from '@/components/discover/marker-pin';
import { DSColors, DSRadius, DSSpacing, DSText } from '@/constants/design-system';
import { DISCOVER_MARKERS, SPORT_TYPES, type SportKey } from '@/constants/discover';
import { BottomTabInset } from '@/constants/theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { useAuth } from '@/providers/auth-context';

const SPORT_KEYS = Object.keys(SPORT_TYPES) as SportKey[];

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function DiscoverScreen() {
  const { user, signOut } = useAuth();
  const { region, status } = useUserLocation();
  const [activeSports, setActiveSports] = useState<SportKey[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const mapRef = useRef<MapView>(null);

  function handleSignOut() {
    signOut();
    router.replace('/');
  }

  function toggleSport(sport: SportKey) {
    setActiveSports((current) =>
      current.includes(sport) ? current.filter((s) => s !== sport) : [...current, sport],
    );
  }

  const markers = useMemo(() => {
    const term = normalize(query.trim());
    return DISCOVER_MARKERS.filter((marker) => {
      if (activeSports.length > 0 && !activeSports.includes(marker.sport)) return false;
      if (!term) return true;
      const haystack = normalize(
        `${marker.title} ${marker.subtitle} ${SPORT_TYPES[marker.sport].label}`,
      );
      return haystack.includes(term);
    });
  }, [activeSports, query]);

  function focusMarker(id: string) {
    setSelectedId(id);
    if (!region) return;
    const marker = DISCOVER_MARKERS.find((m) => m.id === id);
    if (!marker) return;
    mapRef.current?.animateToRegion(
      {
        latitude: region.latitude + marker.offset.lat,
        longitude: region.longitude + marker.offset.lng,
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
          showsUserLocation
          showsMyLocationButton
          onPress={() => setSelectedId(null)}>
          {markers.map((marker) => (
            <Marker
              key={marker.id}
              coordinate={{
                latitude: region.latitude + marker.offset.lat,
                longitude: region.longitude + marker.offset.lng,
              }}
              title={marker.title}
              description={marker.subtitle}
              onPress={() => setSelectedId(marker.id)}>
              <MarkerPin
                color={SPORT_TYPES[marker.sport].color}
                label={SPORT_TYPES[marker.sport].label.charAt(0)}
                dashed={marker.visibility === 'private'}
                selected={selectedId === marker.id}
              />
            </Marker>
          ))}
        </MapView>
      ) : (
        <View style={styles.mapFallback}>
          {status === 'loading' && <ActivityIndicator color={DSColors.primary} />}
          {status === 'denied' && (
            <>
              <Text style={styles.fallbackTitle}>Precisamos da sua localização</Text>
              <Text style={styles.fallbackBody}>
                Ative a permissão de localização para ver o mapa da sua região.
              </Text>
              <Pressable onPress={() => Linking.openSettings()} style={styles.fallbackButton}>
                <Text style={styles.fallbackButtonText}>Abrir configurações</Text>
              </Pressable>
            </>
          )}
          {status === 'error' && (
            <Text style={styles.fallbackBody}>Não foi possível obter sua localização.</Text>
          )}
        </View>
      )}

      <SafeAreaView edges={['top']} style={styles.floatHead}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Esporte, local ou racha"
            placeholderTextColor={DSColors.inkSecondary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          <Pressable
            onPress={handleSignOut}
            style={styles.avatar}
            accessibilityRole="button"
            accessibilityLabel="Sair da conta">
            <Text style={styles.avatarText}>{initials(user?.name ?? '')}</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}>
          {SPORT_KEYS.map((key) => (
            <AsChip
              key={key}
              label={SPORT_TYPES[key].label}
              dotColor={SPORT_TYPES[key].color}
              active={activeSports.includes(key)}
              onPress={() => toggleSport(key)}
            />
          ))}
        </ScrollView>
      </SafeAreaView>

      <View style={[styles.sheet, { paddingBottom: BottomTabInset + DSSpacing[3] }]}>
        <Text style={styles.sheetTitle}>Perto de você</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cards}>
          {markers.map((marker) => (
            <Pressable
              key={marker.id}
              onPress={() => focusMarker(marker.id)}
              style={[styles.card, selectedId === marker.id && styles.cardSelected]}>
              <View
                style={[styles.cardMedia, { backgroundColor: SPORT_TYPES[marker.sport].color }]}>
                <Text style={styles.cardBadge}>{marker.badge}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {marker.title}
                </Text>
                <Text style={styles.cardSubtitle} numberOfLines={1}>
                  {marker.subtitle}
                </Text>
              </View>
            </Pressable>
          ))}
          {markers.length === 0 && (
            <Text style={styles.empty}>Nenhum resultado para esse filtro.</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  fallbackTitle: {
    fontSize: DSText.lg,
    fontWeight: '800',
    color: DSColors.ink,
    textAlign: 'center',
  },
  fallbackBody: {
    fontSize: DSText.sm,
    fontWeight: '600',
    color: DSColors.inkSecondary,
    textAlign: 'center',
  },
  fallbackButton: {
    marginTop: DSSpacing[2],
    paddingHorizontal: 18,
    height: 44,
    borderRadius: DSRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.primary,
  },
  fallbackButtonText: {
    color: DSColors.inverse,
    fontWeight: '800',
  },
  floatHead: {
    gap: DSSpacing[2],
    paddingBottom: DSSpacing[2],
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    marginHorizontal: DSSpacing[4],
    paddingHorizontal: 14,
    borderRadius: DSRadius.lg + 3,
    backgroundColor: DSColors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: DSText.md,
    fontWeight: '700',
    color: DSColors.ink,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.primaryTint,
  },
  avatarText: {
    fontSize: DSText.xs,
    fontWeight: '800',
    color: DSColors.primary,
  },
  chipsRow: {
    paddingHorizontal: DSSpacing[4],
    gap: 8,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: DSColors.surface,
    borderTopLeftRadius: DSRadius.xl,
    borderTopRightRadius: DSRadius.xl,
    paddingTop: DSSpacing[3],
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  sheetTitle: {
    fontSize: DSText.lg,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: DSColors.ink,
    paddingHorizontal: DSSpacing[4],
    marginBottom: DSSpacing[2],
  },
  cards: {
    paddingHorizontal: DSSpacing[4],
    gap: 12,
  },
  card: {
    width: 180,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: DSColors.surface,
    borderWidth: 1,
    borderColor: DSColors.line,
  },
  cardSelected: {
    borderColor: DSColors.primary,
    borderWidth: 2,
  },
  cardMedia: {
    height: 64,
    justifyContent: 'flex-start',
    padding: 8,
  },
  cardBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    color: DSColors.ink,
    fontSize: DSText.xs,
    fontWeight: '800',
    lineHeight: 20,
    overflow: 'hidden',
  },
  cardBody: {
    padding: 10,
    gap: 2,
  },
  cardTitle: {
    fontSize: DSText.sm,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: DSColors.ink,
  },
  cardSubtitle: {
    fontSize: DSText.xs,
    fontWeight: '700',
    color: DSColors.inkSecondary,
  },
  empty: {
    fontSize: DSText.sm,
    fontWeight: '600',
    color: DSColors.inkSecondary,
    paddingVertical: 20,
  },
});
