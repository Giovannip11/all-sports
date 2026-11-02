import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import type { Region } from 'react-native-maps';

export type LocationStatus = 'loading' | 'granted' | 'denied' | 'error';

const DEFAULT_DELTA = 0.02;

export function useUserLocation() {
  const [region, setRegion] = useState<Region | null>(null);
  const [status, setStatus] = useState<LocationStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }

      try {
        const position = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        setRegion({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: DEFAULT_DELTA,
          longitudeDelta: DEFAULT_DELTA,
        });
        setStatus('granted');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { region, status };
}
