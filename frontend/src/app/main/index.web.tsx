// Web-only: react-native-maps has no web renderer, so web uses Leaflet +
// OpenStreetMap tiles instead, fed by the same /map/markers endpoint and the
// browser's real geolocation (via expo-location's web support).
import { router, useFocusEffect } from 'expo-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

import { AsChip } from '@/components/design-system/as-chip';
import { DSColors, DSRadius, DSSpacing, DSText } from '@/constants/design-system';
import { SPORT_TYPES, type SportKey } from '@/constants/discover';
import { BottomTabInset } from '@/constants/theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { ApiError, type ApiMapMarker } from '@/lib/api';
import * as api from '@/lib/api';
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Teardrop pin as a plain Leaflet divIcon — no image assets to bundle. */
function pinIcon(color: string, label: string, dashed: boolean, selected: boolean) {
  const size = selected ? 34 : 26;
  return L.divIcon({
    className: 'as-map-pin',
    html: `<div style="
        width:${size}px;height:${size}px;background:${color};
        border:2px ${dashed ? 'dashed' : 'solid'} #fff;border-radius:100% 100% 100% 2px;
        transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 4px rgba(0,0,0,0.28);">
        <span style="transform:rotate(45deg);color:#fff;font-weight:800;font-size:${selected ? 14 : 11}px;">
          ${label}
        </span>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

const youIcon = L.divIcon({
  className: 'as-map-you',
  html: `<div style="width:16px;height:16px;border-radius:8px;background:${DSColors.primary};border:3px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** Keeps the Leaflet map instance in sync with `center` without remounting it. */
function FlyTo({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, map.getZoom(), { duration: 0.3 });
  }, [center, map]);
  return null;
}

export default function DiscoverScreen() {
  const { user, signOut, accessToken } = useAuth();
  const { region, status, retry } = useUserLocation();
  const [activeSports, setActiveSports] = useState<SportKey[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [allMarkers, setAllMarkers] = useState<ApiMapMarker[]>([]);
  const [flySeq, setFlySeq] = useState(0);
  const flyTarget = useRef<[number, number] | null>(null);

  const loadMarkers = useCallback(async () => {
    if (!accessToken) return;
    try {
      setAllMarkers(await api.listMapMarkers(accessToken));
    } catch (err) {
      console.warn(err instanceof ApiError ? err.message : 'Erro ao carregar o mapa');
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      loadMarkers();
    }, [loadMarkers]),
  );

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
    return allMarkers.filter((marker) => {
      if (activeSports.length > 0 && !activeSports.includes(marker.sport as SportKey)) {
        return false;
      }
      if (!term) return true;
      const sportLabel = SPORT_TYPES[marker.sport as SportKey]?.label ?? marker.sport;
      const haystack = normalize(`${marker.title} ${marker.location} ${sportLabel}`);
      return haystack.includes(term);
    });
  }, [activeSports, allMarkers, query]);

  function focusMarker(id: string) {
    setSelectedId(id);
    const marker = markers.find((m) => m.id === id);
    if (!marker) return;
    flyTarget.current = [marker.latitude, marker.longitude];
    // Force a new array identity so FlyTo's effect re-runs even for the same marker.
    setFlySeq((n) => n + 1);
  }

  return (
    <View style={styles.screen}>
      {region ? (
        <View style={StyleSheet.absoluteFill}>
          <MapContainer
            center={[region.latitude, region.longitude]}
            zoom={15}
            style={{ width: '100%', height: '100%' }}
            attributionControl={true}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <FlyTo key={flySeq} center={flyTarget.current} />
            <Marker position={[region.latitude, region.longitude]} icon={youIcon} />
            {markers.map((marker) => {
              const sportInfo = SPORT_TYPES[marker.sport as SportKey];
              return (
                <Marker
                  key={marker.id}
                  position={[marker.latitude, marker.longitude]}
                  icon={pinIcon(
                    sportInfo?.color ?? DSColors.inkTertiary,
                    (sportInfo?.label ?? marker.sport).charAt(0),
                    marker.visibility === 'private',
                    selectedId === marker.id,
                  )}
                  eventHandlers={{ click: () => setSelectedId(marker.id) }}>
                  <Popup>
                    <strong>{marker.title}</strong>
                    <br />
                    {marker.location} · {formatDate(marker.starts_at)}
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </View>
      ) : (
        <View style={styles.mapFallback}>
          {status === 'loading' && <ActivityIndicator color={DSColors.primary} />}
          {status === 'denied' && (
            <>
              <Text style={styles.fallbackTitle}>Precisamos da sua localização</Text>
              <Text style={styles.fallbackBody}>
                Permita o acesso à localização nas configurações do navegador (ícone de cadeado na
                barra de endereço) para ver o mapa da sua região.
              </Text>
              <Pressable onPress={retry} style={styles.fallbackButton}>
                <Text style={styles.fallbackButtonText}>Tentar novamente</Text>
              </Pressable>
            </>
          )}
          {status === 'error' && (
            <>
              <Text style={styles.fallbackBody}>Não foi possível obter sua localização.</Text>
              <Pressable onPress={retry} style={styles.fallbackButton}>
                <Text style={styles.fallbackButtonText}>Tentar novamente</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      <SafeAreaView edges={['top']} style={styles.floatHead} pointerEvents="box-none">
        <View style={styles.searchBar}>
          <TextInputWeb
            placeholder="Esporte, local ou racha"
            value={query}
            onChangeText={setQuery}
          />
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user?.name ?? '')}</Text>
          </View>
          <Pressable
            onPress={handleSignOut}
            style={styles.signOut}
            accessibilityRole="button"
            accessibilityLabel="Sair da conta">
            <Text style={styles.signOutText}>Sair</Text>
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

      <View
        style={[styles.sheet, { paddingBottom: BottomTabInset + DSSpacing[3] }]}
        pointerEvents="box-none">
        <Text style={styles.sheetTitle}>Perto de você</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cards}>
          {markers.map((marker) => {
            const sportInfo = SPORT_TYPES[marker.sport as SportKey];
            const full = marker.participants_count >= marker.max_participants;
            return (
              <Pressable
                key={marker.id}
                onPress={() => focusMarker(marker.id)}
                style={[styles.card, selectedId === marker.id && styles.cardSelected]}>
                <View
                  style={[
                    styles.cardMedia,
                    { backgroundColor: sportInfo?.color ?? DSColors.inkTertiary },
                  ]}>
                  <Text style={styles.cardBadge}>
                    {marker.visibility === 'private'
                      ? 'Privado'
                      : full
                        ? 'Lotado'
                        : (sportInfo?.label ?? marker.sport)}
                  </Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {marker.title}
                  </Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1}>
                    {marker.location} · {formatDate(marker.starts_at)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          {markers.length === 0 && (
            <Text style={styles.empty}>Nenhum resultado para esse filtro.</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

/** Thin wrapper so the search input keeps the same look without pulling
 * react-native's TextInput through the Leaflet/DOM tree. */
function TextInputWeb({
  placeholder,
  value,
  onChangeText,
}: {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <input
      style={{
        flex: 1,
        height: '100%',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        fontSize: DSText.md,
        fontWeight: 700,
        color: DSColors.ink,
      }}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChangeText(e.target.value)}
    />
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
    // The web-only tab bar (app-tabs.web.tsx) floats on top and isn't accounted
    // for by safe-area insets, so push the header down manually there.
    paddingTop: 56,
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
  signOut: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DSColors.line,
  },
  signOutText: {
    fontSize: DSText.xs,
    fontWeight: '800',
    color: DSColors.ink,
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
