import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

import { DSColors, DSRadius, DSType, type DSColorSet } from '@/constants/design-system';
import { useDSColors } from '@/providers/theme-context';

export type LocationPickerProps = {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
};

const pinIcon = L.divIcon({
  className: 'as-location-picker-pin',
  html: `<div style="
      width:28px;height:28px;background:${DSColors.primary};
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

/** O `center` do MapContainer só vale na montagem: quando o ponto muda por fora
 * (localização mais precisa chegou), o mapa acompanha para o pin não sumir. */
function KeepPinVisible({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.panTo([latitude, longitude], { animate: true });
  }, [latitude, longitude, map]);
  return null;
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
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
          <KeepPinVisible latitude={latitude} longitude={longitude} />
        </MapContainer>
      </View>
      <Text style={styles.help}>Arraste o pin ou clique no mapa para ajustar o ponto exato.</Text>
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