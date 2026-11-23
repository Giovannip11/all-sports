import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';

import { DSColors, DSRadius, DSSpacing, DSText } from '@/constants/design-system';

export type LocationPickerProps = {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
};

const pinIcon = L.divIcon({
  className: 'as-location-picker-pin',
  html: `<div style="
      width:28px;height:28px;background:${DSColors.accent};
      border:2px solid #fff;border-radius:100% 100% 100% 2px;
      transform:rotate(-45deg);box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function DraggableMarker({
  latitude,
  longitude,
  onChange,
}: LocationPickerProps) {
  const markerRef = useRef<L.Marker>(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (!marker) return;
        const { lat, lng } = marker.getLatLng();
        onChange(lat, lng);
      },
    }),
    [onChange],
  );

  return (
    <Marker
      position={[latitude, longitude]}
      icon={pinIcon}
      draggable
      eventHandlers={eventHandlers}
      ref={markerRef}
    />
  );
}

function ClickToMove({ onChange }: { onChange: LocationPickerProps['onChange'] }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Draggable-pin map for picking an event's coordinates — used both when
 * creating an event and when an organizer edits an existing one's location. */
export function LocationPicker({ latitude, longitude, onChange }: LocationPickerProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Local no mapa</Text>
      <View style={styles.mapWrap}>
        <MapContainer
          center={[latitude, longitude]}
          zoom={15}
          style={{ width: '100%', height: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <DraggableMarker latitude={latitude} longitude={longitude} onChange={onChange} />
          <ClickToMove onChange={onChange} />
        </MapContainer>
      </View>
      <Text style={styles.help}>Arraste o pin ou clique no mapa para ajustar o ponto exato.</Text>
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
