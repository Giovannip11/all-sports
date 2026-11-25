// Web-only: react-native-maps has no web renderer, so web uses Leaflet +
// OpenStreetMap tiles instead, fed by the same /map/markers endpoint and the
// browser's real geolocation (via expo-location's web support).
import { useFocusEffect } from 'expo-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

import { AsBanner } from '@/components/design-system/as-banner';
import { AsButton } from '@/components/design-system/as-button';
import { AsIcon } from '@/components/design-system/as-icon';
import { DiscoverOverlay } from '@/components/discover/discover-overlay';
import {
  DSColors,
  DSFonts,
  DSRadius,
  DSSpacing,
  DSText,
  DSType,
  type DSColorSet,
} from '@/constants/design-system';
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
import { formatShortDateTime } from '@/utils/format';

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Teardrop pin as a plain Leaflet divIcon — no image assets to bundle. */
function pinIcon(color: string, label: string, dashed: boolean, selected: boolean) {
  const size = selected ? 40 : 30;
  return L.divIcon({
    className: 'as-map-pin',
    html: `<div style="
        width:${size}px;height:${size}px;background:${color};
        border:2px ${dashed ? 'dashed' : 'solid'} #fff;border-radius:100% 100% 100% 2px;
        transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 4px rgba(26,28,30,0.28);">
        <span style="transform:rotate(45deg);color:#fff;font-weight:700;font-family:Manrope,system-ui,sans-serif;font-size:${selected ? 15 : 12}px;">
          ${label}
        </span>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

const youIcon = L.divIcon({
  className: 'as-map-you',
  html: `<div style="width:16px;height:16px;border-radius:8px;background:${DSColors.you};border:3px solid #fff;box-shadow:0 0 0 6px rgba(26,115,232,0.2);"></div>`,
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

/** Leaflet só percebe mudança de tamanho da janela; quando a área do mapa muda
 * (altura da sheet), ele precisa recalcular, senão sobram faixas cinzas. */
function ResizeWith({ size }: { size: number }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [size, map]);
  return null;
}

/** Recentraliza quando a posição do usuário muda (leitura mais precisa ou ajuste manual). */
function FollowUser({
  latitude,
  longitude,
  enabled,
}: {
  latitude: number;
  longitude: number;
  /** Falso quando a pessoa arrastou o ponto: ele já está onde ela soltou. */
  enabled: boolean;
}) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    // A primeira posição já é o `center` inicial do MapContainer.
    if (first.current) {
      first.current = false;
      return;
    }
    if (enabled) map.setView([latitude, longitude], map.getZoom(), { animate: true });
  }, [latitude, longitude, enabled, map]);
  return null;
}

function formatAccuracy(meters: number) {
  return meters >= 1000
    ? `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
    : `${meters} m`;
}

/** Acima disso o ponto azul provavelmente está longe de onde a pessoa está. */
const IMPRECISE_M = 300;

export default function DiscoverScreen() {
  const { user, accessToken, mySports } = useAuth();
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_FILTERS);
  const { region, status, accuracy, isManual, retry, setManualLocation } = useUserLocation();
  const themeColors = useDSColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const [activeSports, setActiveSports] = useState<SportKey[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [allMarkers, setAllMarkers] = useState<ApiMapMarker[]>([]);
  const [loadingMarkers, setLoadingMarkers] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  // O mapa termina onde a sheet começa (menos a curva do topo dela); antes o
  // centro — e o ponto azul — ficava escondido atrás da sheet.
  const [sheetHeight, setSheetHeight] = useState(0);
  const mapBottom = Math.max(0, sheetHeight - DSRadius.lg);

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
    if (!marker) return;
    // A new array identity makes FlyTo's effect re-run even for the same marker.
    setFlyTarget([marker.latitude, marker.longitude]);
  }

  return (
    <View style={styles.screen}>
      {region ? (
        <View style={[styles.mapArea, { bottom: mapBottom }]}>
          <MapContainer
            center={[region.latitude, region.longitude]}
            zoom={15}
            style={{ width: '100%', height: '100%' }}
            attributionControl={true}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <FlyTo center={flyTarget} />
            <ResizeWith size={mapBottom} />
            <FollowUser
              latitude={region.latitude}
              longitude={region.longitude}
              enabled={!isManual}
            />
            {accuracy !== null && accuracy > 30 && (
              <Circle
                center={[region.latitude, region.longitude]}
                radius={accuracy}
                pathOptions={{
                  color: DSColors.you,
                  weight: 1,
                  fillColor: DSColors.you,
                  fillOpacity: 0.08,
                }}
              />
            )}
            {/* Arrastável: se o navegador errar o lugar, a pessoa corrige à mão. */}
            <Marker
              position={[region.latitude, region.longitude]}
              icon={youIcon}
              draggable
              title="Você está aqui (arraste para corrigir)"
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = (e.target as L.Marker).getLatLng();
                  setManualLocation({ latitude: lat, longitude: lng });
                },
              }}
            />
            {markers.map((marker) => {
              const sportInfo = SPORT_TYPES[marker.sport as SportKey];
              return (
                <Marker
                  key={marker.id}
                  // Texto alternativo do pin (leitor de tela e dica ao passar o mouse).
                  title={`${sportInfo?.label ?? marker.sport}: ${marker.title}`}
                  alt={`${sportInfo?.label ?? marker.sport}: ${marker.title}`}
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
                    {marker.location} · {formatShortDateTime(marker.starts_at)}
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </View>
      ) : (
        <View style={[styles.mapFallback, { bottom: mapBottom }]}>
          {status === 'loading' && (
            <>
              <ActivityIndicator color={themeColors.primary} />
              <Text style={styles.fallbackBody}>Procurando sua localização...</Text>
            </>
          )}
          {status === 'denied' && (
            <>
              <View style={styles.fallbackIcon}>
                <AsIcon name="locate" size={24} color={themeColors.primary} />
              </View>
              <Text style={styles.fallbackTitle}>Precisamos da sua localização</Text>
              <Text style={styles.fallbackBody}>
                Permita o acesso à localização nas configurações do navegador (ícone de cadeado na
                barra de endereço) para ver o mapa da sua região.
              </Text>
              <AsButton
                label="Tentar novamente"
                icon="refresh"
                variant="primary"
                onPress={retry}
                style={styles.fallbackButton}
              />
            </>
          )}
          {status === 'error' && (
            <>
              <View style={styles.fallbackIcon}>
                <AsIcon name="alert" size={24} color={themeColors.danger} />
              </View>
              <Text style={styles.fallbackBody}>Não foi possível obter sua localização.</Text>
              <AsButton
                label="Tentar novamente"
                icon="refresh"
                variant="primary"
                onPress={retry}
                style={styles.fallbackButton}
              />
            </>
          )}
        </View>
      )}

      <DiscoverOverlay
        user={user}
        searchInput={
          <TextInputWeb
            placeholder="Esporte, local ou racha"
            value={query}
            onChangeText={setQuery}
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

      {region && (isManual || (accuracy !== null && accuracy > IMPRECISE_M)) && (
        <View style={styles.locationNotice} pointerEvents="box-none">
          {isManual ? (
            <AsBanner
              tone="info"
              message="Usando a posição que você marcou no mapa."
              action={{ label: 'Usar do aparelho', onPress: retry }}
            />
          ) : (
            <AsBanner
              tone="warning"
              message={`Localização aproximada (±${formatAccuracy(accuracy ?? 0)}). Arraste o ponto azul até onde você está.`}
            />
          )}
        </View>
      )}
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
  const colors = useDSColors();
  return (
    <input
      type="search"
      aria-label="Buscar eventos"
      style={{
        flex: 1,
        minWidth: 0,
        height: '100%',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        fontFamily: DSFonts.body,
        fontSize: DSText.md,
        fontWeight: 500,
        color: colors.ink,
      }}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChangeText(e.target.value)}
    />
  );
}

function createStyles(colors: DSColorSet) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.surface2,
    },
    mapArea: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
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
      backgroundColor: colors.surface,
      marginBottom: DSSpacing[1],
    },
    fallbackTitle: {
      ...DSType.headline,
      color: colors.ink,
      textAlign: 'center',
    },
    fallbackBody: {
      ...DSType.small,
      color: colors.inkSecondary,
      textAlign: 'center',
      maxWidth: 360,
    },
    fallbackButton: {
      marginTop: DSSpacing[2],
    },
    locationNotice: {
      position: 'absolute',
      top: 124,
      left: DSSpacing[4],
      right: DSSpacing[4],
      maxWidth: 560,
      alignSelf: 'center',
      marginHorizontal: 'auto',
    },
  });
}
