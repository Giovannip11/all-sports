import type { ReactNode } from 'react';
import { View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import type { IconName } from './icon-names';

export type { IconName } from './icon-names';

export type AsIconProps = {
  name: IconName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
};

/**
 * Ícones da web em SVG inline, com o mesmo traço (1.8, pontas redondas) do
 * design-system/index.html. Não usa expo-symbols na web: a fonte Material
 * Symbols dependeria de carregamento externo não documentado no SDK 57.
 */
const PATHS: Record<IconName, ReactNode> = {
  back: <path d="M14.5 5.5L8 12l6.5 6.5" />,
  forward: <path d="M9.5 5.5L16 12l-6.5 6.5" />,
  close: <path d="M7 7l10 10M17 7L7 17" />,
  plus: <path d="M12 5v14M5 12h14" />,
  bell: (
    <>
      <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5l1.5-1.5z" />
      <path d="M10 20.2a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M8 3.8v4M16 3.8v4M4 10h16" />
    </>
  ),
  map: (
    <>
      <path d="M4 6.5l5-2 6 2 5-2v13l-5 2-6-2-5 2v-13z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3" />
      <path d="M5.5 19c1-3.1 3.2-4.7 6.5-4.7s5.5 1.6 6.5 4.7" />
    </>
  ),
  send: <path d="M4.5 11.5L19.5 4.5l-5 15-2.8-6.2-7.2-1.8z" />,
  check: <path d="M5 12.5l4.2 4.2L19 7.2" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.25" />
      <path d="M16 16.2L20 20.2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6-5.1 6-9.6A6 6 0 0 0 6 11.4C6 15.9 12 21 12 21z" />
      <circle cx="12" cy="11.2" r="2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="7.25" />
      <path d="M12 8v4.4l2.8 1.8" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="9" r="2.5" />
      <path d="M4.6 18.2c.6-2.5 2.3-3.8 4.4-3.8s3.8 1.3 4.4 3.8" />
      <circle cx="16.2" cy="9.4" r="2" />
      <path d="M15.2 14.6c1.5.3 2.7 1.2 3.4 3" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4.5h8v4.8a4 4 0 0 1-8 0V4.5z" />
      <path d="M8 6.5H5.8A2.3 2.3 0 0 0 8 10.2M16 6.5h2.2A2.3 2.3 0 0 1 16 10.2M12 13.3V16M9.2 19.5h5.6" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H10" />
      <path d="M14.5 8l4 4-4 4M18.5 12H9.5" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14M10 4.5h4M7 7l.8 12a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9L17 7" />
      <path d="M10.2 10.5v6M13.8 10.5v6" />
    </>
  ),
  edit: <path d="M5 19l1-4L15.5 5.5a2.1 2.1 0 0 1 3 3L9 18l-4 1zM13.5 7.5l3 3" />,
  chat: (
    <>
      <path d="M4.5 6.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H9l-3 2.5v-2.5h-.5a1 1 0 0 1-1-1v-6z" />
      <path d="M18 9.5h.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H18V20l-3-2.5h-3.5" />
    </>
  ),
  shuffle: (
    <>
      <path d="M17 7.2H8.8A3.3 3.3 0 0 0 5.5 10.5V13" />
      <path d="M7 16.8h8.2a3.3 3.3 0 0 0 3.3-3.3V11" />
      <path d="M14.6 4.6L17.4 7.2 14.6 9.8M9.4 14.2L6.6 16.8 9.4 19.4" />
    </>
  ),
  star: (
    <path
      fill="currentColor"
      stroke="none"
      d="M12 3.6l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.9l5-.7L12 3.6z"
    />
  ),
  eye: (
    <>
      <path d="M2.8 12S6.2 6.8 12 6.8 21.2 12 21.2 12 17.8 17.2 12 17.2 2.8 12 2.8 12z" />
      <circle cx="12" cy="12" r="2.2" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M2.8 12S6.2 6.8 12 6.8 21.2 12 21.2 12 17.8 17.2 12 17.2 2.8 12 2.8 12z" />
      <path d="M5 4.5l14 15" />
    </>
  ),
  refresh: (
    <>
      <path d="M18.5 12a6.5 6.5 0 1 1-2-4.7" />
      <path d="M17 3.8v3.8h-3.8" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="7.25" />
      <path d="M12 8v4.8M12 15.8v.2" />
    </>
  ),
  lock: (
    <>
      <rect x="6" y="10.5" width="12" height="8.5" rx="2" />
      <path d="M8.5 10.5V8.2a3.5 3.5 0 0 1 7 0v2.3" />
    </>
  ),
  locate: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5V6M12 18v2.5M3.5 12H6M18 12h2.5" />
    </>
  ),
  up: <path d="M5.5 14.5L12 8l6.5 6.5" />,
  down: <path d="M5.5 9.5L12 16l6.5-6.5" />,
  filter: <path d="M4.5 6.5h15M7.5 12h9M10.5 17.5h3" />,
};

export function AsIcon({ name, size = 22, color, style }: AsIconProps) {
  return (
    <View
      style={[{ width: size, height: size }, style]}
      aria-hidden
      pointerEvents="none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: color as string, display: 'block' }}>
        {PATHS[name]}
      </svg>
    </View>
  );
}
