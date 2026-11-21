import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Region } from 'react-native-maps';

export type LocationStatus = 'loading' | 'granted' | 'denied' | 'error';

const DEFAULT_DELTA = 0.02;

export function useUserLocation() {
  const [region, setRegion] = useState<Region | null>(null);
  const [status, setStatus] = useState<LocationStatus>('loading');
  const cancelledRef = useRef(false);

  const request = useCallback(async () => {
    setStatus('loading');
    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (cancelledRef.current) return;

      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      if (cancelledRef.current) return;
      setRegion({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
      });
      setStatus('granted');
    } catch {
      if (!cancelledRef.current) setStatus('error');
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    request();
    return () => {
      cancelledRef.current = true;
    };
  }, [request]);

  return { region, status, retry: request };
}
