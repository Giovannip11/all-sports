/** Mock data for the discovery map — no backend wired up yet. */

export type SportKey = 'futebol' | 'basquete' | 'volei' | 'poliesportiva' | 'corrida';

export const SPORT_TYPES: Record<SportKey, { label: string; color: string }> = {
  futebol: { label: 'Futebol', color: '#16a34a' },
  basquete: { label: 'Basquete', color: '#dc2626' },
  volei: { label: 'Vôlei', color: '#ca8a04' },
  poliesportiva: { label: 'Poliesportiva', color: '#7c3aed' },
  corrida: { label: 'Corrida', color: '#0d9488' },
};

export type DiscoverMarker = {
  id: string;
  kind: 'event' | 'court';
  sport: SportKey;
  title: string;
  subtitle: string;
  badge: string;
  visibility: 'public' | 'private';
  /** Position within the map canvas, as percentages. */
  position: { x: `${number}%`; y: `${number}%` };
};

export const DISCOVER_MARKERS: DiscoverMarker[] = [
  {
    id: 'racha-quinta',
    kind: 'event',
    sport: 'futebol',
    title: 'Pelada de quinta',
    subtitle: 'Arena Leste · 1,2 km',
    badge: 'Grátis',
    visibility: 'public',
    position: { x: '46%', y: '48%' },
  },
  {
    id: 'quadra-poliesportiva-parque',
    kind: 'court',
    sport: 'poliesportiva',
    title: 'Quadra do Parque das Águas',
    subtitle: 'Aberta até 22h',
    badge: 'Quadra',
    visibility: 'public',
    position: { x: '20%', y: '38%' },
  },
  {
    id: 'basquete-3x3',
    kind: 'event',
    sport: 'basquete',
    title: 'Basquete 3x3',
    subtitle: 'Ginásio do Centro · 2,1 km',
    badge: 'R$ 10',
    visibility: 'public',
    position: { x: '72%', y: '36%' },
  },
  {
    id: 'volei-areia',
    kind: 'event',
    sport: 'volei',
    title: 'Aberto de vôlei de areia',
    subtitle: 'Areia do Lago · 3,4 km',
    badge: 'Campeonato',
    visibility: 'public',
    position: { x: '62%', y: '66%' },
  },
  {
    id: 'giro-parque',
    kind: 'event',
    sport: 'corrida',
    title: 'Giro do parque',
    subtitle: 'Amanhã · 6:30',
    badge: 'Grupo',
    visibility: 'public',
    position: { x: '30%', y: '60%' },
  },
  {
    id: 'racha-fechado',
    kind: 'event',
    sport: 'futebol',
    title: 'Racha dos amigos',
    subtitle: 'Só convidados · 800 m',
    badge: 'Privado',
    visibility: 'private',
    position: { x: '54%', y: '26%' },
  },
];

/** Where "you" are on the map — mocked, will come from geolocation later. */
export const YOU_POSITION = { x: '50%', y: '50%' } as const;
