import { Platform, type TextStyle } from 'react-native';

/**
 * All Sports brand tokens — identidade "Várzea".
 *
 * Verde de gramado (primary) é a cor da marca: ação principal, aba ativa,
 * seleção e links. Dourado de troféu (accent) marca campeonato, ranking e
 * destaque — sempre como fundo com texto ink, nunca como texto.
 * Vermelho de apito (danger) só para erro e ações destrutivas.
 */

export const DSColorsLight = {
  ink: '#1a1c1e',
  inkSecondary: '#5a635f',
  inkTertiary: '#6b7470',
  /** Texto/ícone sobre fundos escuros fixos (fotos, pins, sobreposições). */
  inverse: '#ffffff',

  bg: '#f3f5f4',
  surface: '#ffffff',
  surface2: '#e9eeeb',
  line: '#e1e6e3',
  lineStrong: '#c9d1cd',

  primary: '#0c6e52',
  primaryPressed: '#095a43',
  primaryTint: '#e3f1eb',
  primaryTint2: '#c3e2d4',
  /** Texto/ícone sobre `primary`. */
  onPrimary: '#ffffff',

  accent: '#f2b400',
  accentPressed: '#d9a100',
  accentTint: '#fff4cc',
  /** Texto/ícone sobre `accent`. */
  onAccent: '#1a1c1e',

  danger: '#c4322b',
  dangerPressed: '#a3271f',
  dangerTint: '#fdeceb',
  onDanger: '#ffffff',

  warning: '#8a5a00',
  warningTint: '#fff3d8',

  /** Ponto "você" no mapa — convenção de mapas, não usar em outra coisa. */
  you: '#1a73e8',

  /** Véu sobre imagens (ex.: avatar enviando). */
  scrim: 'rgba(26, 28, 30, 0.5)',
  shadow: '#1a1c1e',
} as const;

export const DSColorsDark = {
  ink: '#eef1ef',
  inkSecondary: '#a9b2ad',
  inkTertiary: '#87918c',
  inverse: '#ffffff',

  bg: '#0f1211',
  surface: '#181c1a',
  surface2: '#202522',
  line: '#2c322f',
  lineStrong: '#3b433f',

  primary: '#3fb68b',
  primaryPressed: '#5cc59f',
  primaryTint: '#16291f',
  primaryTint2: '#1f3b2d',
  onPrimary: '#0f1211',

  accent: '#f2b400',
  accentPressed: '#ffc933',
  accentTint: '#33290a',
  onAccent: '#1a1c1e',

  danger: '#f27a74',
  dangerPressed: '#f59a95',
  dangerTint: '#3a1917',
  onDanger: '#0f1211',

  warning: '#f2c25c',
  warningTint: '#33280f',

  you: '#4d9bff',

  scrim: 'rgba(0, 0, 0, 0.55)',
  shadow: '#000000',
} as const;

export type DSColorSet = { [K in keyof typeof DSColorsLight]: string };

/** Paleta clara fixa — para valores que não dependem do tema (ex.: HTML de pins do Leaflet). */
export const DSColors = DSColorsLight;

/** Escala de 4 em 4. */
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

/** Raio por hierarquia: controle pequeno < botão/cartão < sheet. */
export const DSRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const DSText = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
} as const;

/** Alvo mínimo de toque e larguras máximas de conteúdo (web/tablet). */
export const DSLayout = {
  touch: 44,
  control: 48,
  maxContent: 640,
  maxForm: 520,
} as const;

/** Altura aproximada da barra de abas, para o conteúdo rolar por baixo dela. */
export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 72 }) ?? 0;

/**
 * Famílias. Barlow Condensed (estática) é carregada via expo-font em todas as
 * plataformas. Manrope só existe como fonte variável no google/fonts; ela é
 * servida pela web via @font-face (src/global.css) e, no nativo, o texto usa a
 * fonte do sistema até existirem instâncias estáticas.
 */
const bodyFamily = Platform.select<string | undefined>({
  web: 'Manrope, "Segoe UI", system-ui, sans-serif',
  default: undefined,
});

export const DSFonts = {
  body: bodyFamily,
  display: 'BarlowCondensed-Bold',
  displaySemi: 'BarlowCondensed-SemiBold',
} as const;

/**
 * Estilos de texto prontos. As variantes Barlow não definem fontWeight (a
 * família já é o peso; combinar os dois quebra a fonte no iOS/Android).
 */
export const DSType = {
  /** Número de placar/nome grande — o elemento marcante da identidade. */
  display: {
    fontFamily: DSFonts.display,
    fontSize: DSText['3xl'],
    lineHeight: 42,
  },
  /** Título de tela. */
  title: {
    fontFamily: DSFonts.display,
    fontSize: DSText['2xl'],
    lineHeight: 34,
  },
  /** Número/placar em linha (vagas, hora, preço). */
  score: {
    fontFamily: DSFonts.display,
    fontSize: DSText.xl,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
  },
  scoreSm: {
    fontFamily: DSFonts.displaySemi,
    fontSize: DSText.lg,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  headline: {
    fontFamily: DSFonts.body,
    fontSize: DSText.lg,
    lineHeight: 26,
    fontWeight: '700',
  },
  body: {
    fontFamily: DSFonts.body,
    fontSize: DSText.md,
    lineHeight: 22,
    fontWeight: '500',
  },
  bodyStrong: {
    fontFamily: DSFonts.body,
    fontSize: DSText.md,
    lineHeight: 22,
    fontWeight: '700',
  },
  label: {
    fontFamily: DSFonts.body,
    fontSize: DSText.sm,
    lineHeight: 18,
    fontWeight: '600',
  },
  labelStrong: {
    fontFamily: DSFonts.body,
    fontSize: DSText.sm,
    lineHeight: 18,
    fontWeight: '700',
  },
  small: {
    fontFamily: DSFonts.body,
    fontSize: DSText.sm,
    lineHeight: 20,
    fontWeight: '500',
  },
  meta: {
    fontFamily: DSFonts.body,
    fontSize: DSText.xs,
    lineHeight: 16,
    fontWeight: '600',
  },
} satisfies Record<string, TextStyle>;

export type DSTypeVariant = keyof typeof DSType;

/** Única sombra do sistema — só para o que flutua sobre o mapa. */
export const DSShadow1 = {
  shadowColor: '#1a1c1e',
  shadowOpacity: 0.12,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
} as const;
