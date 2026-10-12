/**
 * All Sports brand tokens — Azul Esportivo / Laranja Vibrante palette.
 * Primary (blue) carries trust, links and selection; accent (orange) is reserved
 * for CTAs — the single action the screen wants you to take.
 */

export const DSColors = {
  ink: '#111111',
  inkSecondary: '#5c6370',
  inkTertiary: '#9aa0a8',
  inverse: '#ffffff',

  bg: '#ffffff',
  surface: '#ffffff',
  surface2: '#f2f4f8',
  line: '#e5e8ec',
  lineStrong: '#d7dbe0',

  primary: '#0052ff',
  primaryPressed: '#0040cc',
  primaryTint: '#e6eeff',
  primaryTint2: '#c7d9ff',

  accent: '#ff5500',
  accentPressed: '#cc4400',
  accentTint: '#ffe9df',

  danger: '#c4322b',
  dangerTint: '#fdeceb',
} as const;

export const DSSpacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 48,
} as const;

export const DSRadius = {
  sm: 5,
  md: 7,
  lg: 9,
  xl: 14,
  pill: 999,
} as const;

export const DSText = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 34,
} as const;

export const DSShadow1 = {
  shadowColor: '#1a1c1e',
  shadowOpacity: 0.1,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;
