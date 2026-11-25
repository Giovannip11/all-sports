import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { Region } from 'react-native-maps';

export type LocationStatus = 'loading' | 'granted' | 'denied' | 'error';

const DEFAULT_DELTA = 0.02;
/** Quanto tempo continuar refinando a posição depois da primeira leitura. */
const REFINE_WINDOW_MS = 60_000;
/** Com essa precisão (metros) já dá para parar de refinar. */
const GOOD_ACCURACY_M = 50;
const QUICK_TIMEOUT_MS = 8_000;

const MANUAL_KEY = 'all-sports-manual-location';

type Coords = { latitude: number; longitude: number };

// Posição corrigida à mão (web): quando o navegador erra o lugar — comum em
// computador, que estima pela rede ou pelo IP — a pessoa arrasta o ponto azul
// e o app passa a usar esse ponto até ela pedir a localização de novo.
function readManual(): Coords | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(MANUAL_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return typeof value?.latitude === 'number' && typeof value?.longitude === 'number'
      ? { latitude: value.latitude, longitude: value.longitude }
      : null;
  } catch {
    return null;
  }
}

function writeManual(value: Coords | null) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value) localStorage.setItem(MANUAL_KEY, JSON.stringify(value));
    else localStorage.removeItem(MANUAL_KEY);
  } catch {
    // Sem armazenamento: a correção vale só enquanto a tela estiver aberta.
  }
}

type Subscription = { remove: () => void };

/**
 * Web: usa o navigator direto. O watchPositionAsync do expo-location na web
 * não chama clearWatch no remove() e confunde os ids do watch, então o
 * callback pode nunca ser chamado.
 */
function watchBrowser(onPosition: (p: Location.LocationObject) => void): Subscription | null {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  const id = navigator.geolocation.watchPosition(
    (p) =>
      onPosition({
        timestamp: p.timestamp,
        coords: {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          altitude: p.coords.altitude,
          accuracy: p.coords.accuracy,
          altitudeAccuracy: p.coords.altitudeAccuracy,
          heading: p.coords.heading,
          speed: p.coords.speed,
        },
      }),
    undefined,
    { enableHighAccuracy: true, maximumAge: 0 },
  );
  return { remove: () => navigator.geolocation.clearWatch(id) };
}

function watchNative(onPosition: (p: Location.LocationObject) => void): Promise<Subscription> {
  return Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Highest, distanceInterval: 0 },
    onPosition,
  );
}

function toRegion({ latitude, longitude }: Coords): Region {
  return { latitude, longitude, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA };
}

/**
 * Localização do aparelho em duas etapas:
 * 1. uma leitura rápida (pode vir do cache ou ser aproximada), para o mapa
 *    abrir logo;
 * 2. leituras de alta precisão por até 1 min, que só substituem a atual quando
 *    são mais precisas. Na web o expo-location repassa as opções direto ao
 *    navegador no watch, por isso `enableHighAccuracy`/`maximumAge` vão junto.
 *
 * `accuracy` é o raio de incerteza em metros (null se desconhecido ou manual).
 */
export function useUserLocation() {
  const [manual, setManual] = useState<Coords | null>(() => readManual());
  const [deviceRegion, setDeviceRegion] = useState<Region | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState<LocationStatus>(() =>
    readManual() ? 'granted' : 'loading',
  );
  const cancelledRef = useRef(false);
  const bestAccuracyRef = useRef<number>(Infinity);
  const watchRef = useRef<Subscription | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopWatching = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
  }, []);

  const accept = useCallback((position: Location.LocationObject) => {
    const acc = position.coords.accuracy ?? Infinity;
    // Só troca se a nova leitura for mais precisa (ou a primeira).
    if (acc >= bestAccuracyRef.current && bestAccuracyRef.current !== Infinity) return false;
    bestAccuracyRef.current = acc;
    setDeviceRegion(toRegion(position.coords));
    setAccuracy(Number.isFinite(acc) ? Math.round(acc) : null);
    setStatus('granted');
    return true;
  }, []);

  const request = useCallback(async () => {
    stopWatching();
    bestAccuracyRef.current = Infinity;
    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (cancelledRef.current) return;
      if (permission !== 'granted') {
        if (!readManual()) setStatus('denied');
        return;
      }

      // 1. Leitura rápida (com limite: na web ela pode nunca responder).
      try {
        const quick = await Promise.race([
          Location.getCurrentPositionAsync({}),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), QUICK_TIMEOUT_MS),
          ),
        ]);
        if (cancelledRef.current) return;
        accept(quick);
      } catch {
        // Sem leitura rápida: espera as de alta precisão abaixo.
      }

      // 2. Refinamento em alta precisão.
      const onPosition = (position: Location.LocationObject) => {
        if (cancelledRef.current) return;
        accept(position);
        if ((position.coords.accuracy ?? Infinity) <= GOOD_ACCURACY_M) stopWatching();
      };
      watchRef.current =
        Platform.OS === 'web' ? watchBrowser(onPosition) : await watchNative(onPosition);
      if (cancelledRef.current) {
        stopWatching();
        return;
      }
      stopTimerRef.current = setTimeout(() => {
        stopWatching();
        if (!cancelledRef.current && bestAccuracyRef.current === Infinity) setStatus('error');
      }, REFINE_WINDOW_MS);
    } catch {
      if (!cancelledRef.current && bestAccuracyRef.current === Infinity) setStatus('error');
    }
  }, [accept, stopWatching]);

  useEffect(() => {
    cancelledRef.current = false;
    // Falso positivo: `request` só chama setState depois de um `await`
    // (resposta da permissão/GPS), ou seja, como assinatura de algo externo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    request();
    return () => {
      cancelledRef.current = true;
      stopWatching();
    };
  }, [request, stopWatching]);

  /** Pede a localização do aparelho de novo e descarta a correção manual. */
  const retry = useCallback(() => {
    writeManual(null);
    setManual(null);
    if (!deviceRegion) setStatus('loading');
    request();
  }, [deviceRegion, request]);

  /** Fixa a posição à mão (ex.: arrastando o ponto azul no mapa da web). */
  const setManualLocation = useCallback((coords: Coords) => {
    writeManual(coords);
    setManual(coords);
    setStatus('granted');
  }, []);

  const manualRegion = useMemo(() => (manual ? toRegion(manual) : null), [manual]);
  const region = manualRegion ?? deviceRegion;
  return {
    region,
    status,
    accuracy: manual ? null : accuracy,
    isManual: !!manual,
    retry,
    setManualLocation,
  };
}
