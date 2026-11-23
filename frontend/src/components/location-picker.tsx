import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type LatLng } from 'react-native-maps';

import { DSColors, DSRadius, DSSpacing, DSText } from '@/constants/design-system';

export type LocationPickerProps = {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
};

/** Draggable-pin map for picking an event's coordinates — used both when
 * creating an event and when an organizer edits an existing one's location. */
export function LocationPicker({ latitude, longitude, onChange }: LocationPickerProps) {
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

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: DSText.sm, fontWeight: '800', color: DSColors.ink },
  mapWrap: {
    height: 220,
    borderRadius: DSRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DSColors.line,
  },
  help: { fontSize: DSText.xs, fontWeight: '600', color: DSColors.inkSecondary },
});
