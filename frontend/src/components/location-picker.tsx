import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type LatLng } from 'react-native-maps';

import { DSRadius, DSType, type DSColorSet } from '@/constants/design-system';
import { useDSColors } from '@/providers/theme-context';

export type LocationPickerProps = {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
};

/** Draggable-pin map for picking an event's coordinates — used both when
 * creating an event and when an organizer edits an existing one's location. */
export function LocationPicker({ latitude, longitude, onChange }: LocationPickerProps) {
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  function handleMove(coordinate: LatLng) {
    onChange(coordinate.latitude, coordinate.longitude);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Local no mapa</Text>
      <View style={styles.mapWrap}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onPress={(e) => handleMove(e.nativeEvent.coordinate)}>
          <Marker
            coordinate={{ latitude, longitude }}
            draggable
            onDragEnd={(e) => handleMove(e.nativeEvent.coordinate)}
          />
        </MapView>
      </View>
      <Text style={styles.help}>Arraste o pin ou toque no mapa para ajustar o ponto exato.</Text>
    </View>
  );
}

function createStyles(colors: DSColorSet) {
  return StyleSheet.create({
    field: { gap: 6 },
    label: { ...DSType.label, color: colors.ink },
    mapWrap: {
      height: 220,
      borderRadius: DSRadius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.line,
    },
    help: { ...DSType.meta, color: colors.inkSecondary },
  });
}