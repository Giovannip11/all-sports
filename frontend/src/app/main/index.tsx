import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsChip } from '@/components/design-system/as-chip';
import { MapPin } from '@/components/discover/map-pin';
import { DSColors, DSRadius, DSSpacing, DSText } from '@/constants/design-system';
import { DISCOVER_MARKERS, SPORT_TYPES, YOU_POSITION, type SportKey } from '@/constants/discover';
import { BottomTabInset } from '@/constants/theme';
import { useAuth } from '@/providers/auth-context';

const SPORT_KEYS = Object.keys(SPORT_TYPES) as SportKey[];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function DiscoverScreen() {
  const { user, signOut } = useAuth();
  const [activeSports, setActiveSports] = useState<SportKey[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function handleSignOut() {
    signOut();
    router.replace('/');
  }

  function toggleSport(sport: SportKey) {
    setActiveSports((current) =>
      current.includes(sport) ? current.filter((s) => s !== sport) : [...current, sport],
    );
  }

  const markers = useMemo(
    () =>
      activeSports.length === 0
        ? DISCOVER_MARKERS
        : DISCOVER_MARKERS.filter((marker) => activeSports.includes(marker.sport)),
    [activeSports],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.map}>
        <View style={[styles.blob, styles.blobPrimary]} />
        <View style={[styles.blob, styles.blobAccent]} />
        <View style={styles.roadH} />
        <View style={styles.roadV} />

        <View style={[styles.you, { left: YOU_POSITION.x, top: YOU_POSITION.y }]} />

        {markers.map((marker) => (
          <MapPin
            key={marker.id}
            x={marker.position.x}
            y={marker.position.y}
            color={SPORT_TYPES[marker.sport].color}
            label={SPORT_TYPES[marker.sport].label.charAt(0)}
            dashed={marker.visibility === 'private'}
            selected={selectedId === marker.id}
            caption={selectedId === marker.id ? marker.title : undefined}
            onPress={() => setSelectedId((current) => (current === marker.id ? null : marker.id))}
          />
        ))}
      </View>

      <SafeAreaView edges={['top']} style={styles.floatHead}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Esporte, local ou racha"
            placeholderTextColor={DSColors.inkSecondary}
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
            <View key={marker.id} style={styles.card}>
              <View style={[styles.cardMedia, { backgroundColor: SPORT_TYPES[marker.sport].color }]}>
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
            </View>
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
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobPrimary: {
    width: 260,
    height: 220,
    top: -60,
    right: -60,
    backgroundColor: DSColors.primaryTint,
  },
  blobAccent: {
    width: 200,
    height: 180,
    bottom: 140,
    left: -50,
    backgroundColor: DSColors.accentTint,
  },
  roadH: {
    position: 'absolute',
    left: '-10%',
    right: '-10%',
    top: '46%',
    height: 10,
    backgroundColor: DSColors.surface,
  },
  roadV: {
    position: 'absolute',
    top: '-10%',
    bottom: '-10%',
    left: '58%',
    width: 10,
    backgroundColor: DSColors.surface,
  },
  you: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: DSColors.primary,
    borderWidth: 3,
    borderColor: DSColors.inverse,
    transform: [{ translateX: -11 }, { translateY: -11 }],
  },
  floatHead: {
    gap: DSSpacing[2],
    paddingBottom: DSSpacing[2],
    // The web-only tab bar (app-tabs.web.tsx) floats on top and isn't accounted
    // for by safe-area insets, so push the header down manually there.
    paddingTop: Platform.OS === 'web' ? 56 : 0,
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
