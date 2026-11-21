export type SportKey = 'futebol' | 'basquete' | 'volei' | 'poliesportiva' | 'corrida';

export const SPORT_TYPES: Record<SportKey, { label: string; color: string }> = {
  futebol: { label: 'Futebol', color: '#16a34a' },
  basquete: { label: 'Basquete', color: '#dc2626' },
  volei: { label: 'Vôlei', color: '#ca8a04' },
  poliesportiva: { label: 'Poliesportiva', color: '#7c3aed' },
  corrida: { label: 'Corrida', color: '#0d9488' },
};
