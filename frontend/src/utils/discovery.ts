/**
 * Regras de descoberta compartilhadas pelo mapa e pela lista de Eventos:
 * filtros de data, horário e distância (DISC-03) e ordenação pelos esportes
 * preferidos do perfil (DISC-04 / RF05).
 */

export type DateFilter = 'all' | 'today' | 'tomorrow' | 'weekend' | 'week';
export type TimeFilter = 'all' | 'morning' | 'afternoon' | 'night';
/** Raio em km; null = qualquer distância. */
export type DistanceFilter = number | null;

export type DiscoveryFilters = {
  date: DateFilter;
  time: TimeFilter;
  distanceKm: DistanceFilter;
};

export const DEFAULT_FILTERS: DiscoveryFilters = { date: 'all', time: 'all', distanceKm: null };

export const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'all', label: 'Qualquer dia' },
  { value: 'today', label: 'Hoje' },
  { value: 'tomorrow', label: 'Amanhã' },
  { value: 'weekend', label: 'Fim de semana' },
  { value: 'week', label: 'Próximos 7 dias' },
];

export const TIME_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: 'Qualquer hora' },
  { value: 'morning', label: 'Manhã (até 12h)' },
  { value: 'afternoon', label: 'Tarde (12h–18h)' },
  { value: 'night', label: 'Noite (após 18h)' },
];

export const DISTANCE_OPTIONS: { value: DistanceFilter; label: string }[] = [
  { value: null, label: 'Qualquer distância' },
  { value: 2, label: 'Até 2 km' },
  { value: 5, label: 'Até 5 km' },
  { value: 10, label: 'Até 10 km' },
  { value: 25, label: 'Até 25 km' },
];

export function activeFilterCount(f: DiscoveryFilters) {
  return (f.date !== 'all' ? 1 : 0) + (f.time !== 'all' ? 1 : 0) + (f.distanceKm !== null ? 1 : 0);
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function matchesDate(iso: string, filter: DateFilter, now = new Date()) {
  if (filter === 'all') return true;
  const date = new Date(iso);
  const today = startOfDay(now);
  const day = startOfDay(date);
  const diffDays = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  switch (filter) {
    case 'today':
      return diffDays === 0;
    case 'tomorrow':
      return diffDays === 1;
    case 'week':
      return diffDays >= 0 && diffDays <= 7;
    case 'weekend': {
      // O próximo sábado e domingo (ou o atual, se hoje já é fim de semana).
      const weekday = today.getDay(); // 0 = domingo
      const toSaturday = weekday === 0 ? -1 : 6 - weekday;
      return diffDays === toSaturday || diffDays === toSaturday + 1;
    }
  }
}

export function matchesTime(iso: string, filter: TimeFilter) {
  if (filter === 'all') return true;
  const hour = new Date(iso).getHours();
  if (filter === 'morning') return hour < 12;
  if (filter === 'afternoon') return hour >= 12 && hour < 18;
  return hour >= 18;
}

/** Distância em km entre dois pontos (haversine). */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

type Discoverable = { sport: string; starts_at: string; latitude: number; longitude: number };

/**
 * Aplica os filtros e ordena: esportes preferidos primeiro (pela prioridade do
 * perfil), depois pela data mais próxima. Sem localização, o filtro de
 * distância é ignorado (a tela avisa).
 */
export function applyDiscovery<T extends Discoverable>(
  items: T[],
  filters: DiscoveryFilters,
  origin: { latitude: number; longitude: number } | null,
  priority: Record<string, number>,
): T[] {
  return items
    .filter((item) => matchesDate(item.starts_at, filters.date))
    .filter((item) => matchesTime(item.starts_at, filters.time))
    .filter(
      (item) =>
        filters.distanceKm === null || !origin || distanceKm(origin, item) <= filters.distanceKm,
    )
    .sort((a, b) => {
      const pa = priority[a.sport] ?? Number.MAX_SAFE_INTEGER;
      const pb = priority[b.sport] ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return a.starts_at.localeCompare(b.starts_at);
    });
}

/** slug -> posição (1 = principal), a partir dos esportes do perfil. */
export function priorityMap(sports: { sport: string; position: number }[]) {
  return Object.fromEntries(sports.map((s) => [s.sport, s.position])) as Record<string, number>;
}
