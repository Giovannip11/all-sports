/** Mesmos slugs da tabela `sports` do banco. */
export type SportKey =
  | 'futebol'
  | 'basquete'
  | 'volei'
  | 'poliesportiva'
  | 'corrida'
  | 'ciclismo'
  | 'natacao';

/** Cores de esporte (dado, não interface). Todas passam 3:1 com rótulo branco no pin. */
export const SPORT_TYPES: Record<SportKey, { label: string; color: string }> = {
  futebol: { label: 'Futebol', color: '#0c6e52' },
  basquete: { label: 'Basquete', color: '#d24b32' },
  volei: { label: 'Vôlei', color: '#b07f00' },
  poliesportiva: { label: 'Poliesportiva', color: '#7a4eab' },
  corrida: { label: 'Corrida', color: '#c95a0c' },
  ciclismo: { label: 'Bike', color: '#2b5fb8' },
  natacao: { label: 'Natação', color: '#0b7285' },
};

export const SPORT_KEYS = Object.keys(SPORT_TYPES) as SportKey[];

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export const SKILL_LABEL: Record<SkillLevel, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};
