/**
 * Conjunto fechado de ícones do app. Cada nome mapeia para um SF Symbol (iOS)
 * e um Material Symbol (Android). Na web, o mesmo nome desenha um SVG próprio
 * (ver as-icon.web.tsx), com os traços do design-system/index.html.
 */
export const ICONS = {
  back: { ios: 'chevron.left', android: 'chevron_left' },
  forward: { ios: 'chevron.right', android: 'chevron_right' },
  close: { ios: 'xmark', android: 'close' },
  plus: { ios: 'plus', android: 'add' },
  bell: { ios: 'bell', android: 'notifications' },
  calendar: { ios: 'calendar', android: 'calendar_month' },
  map: { ios: 'map', android: 'map' },
  user: { ios: 'person.crop.circle', android: 'person' },
  send: { ios: 'paperplane.fill', android: 'send' },
  check: { ios: 'checkmark', android: 'check' },
  search: { ios: 'magnifyingglass', android: 'search' },
  pin: { ios: 'mappin.and.ellipse', android: 'location_on' },
  clock: { ios: 'clock', android: 'schedule' },
  users: { ios: 'person.2', android: 'group' },
  trophy: { ios: 'trophy', android: 'trophy' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
  trash: { ios: 'trash', android: 'delete' },
  edit: { ios: 'pencil', android: 'edit' },
  chat: { ios: 'bubble.left.and.bubble.right', android: 'forum' },
  shuffle: { ios: 'shuffle', android: 'shuffle' },
  star: { ios: 'star.fill', android: 'star' },
  eye: { ios: 'eye', android: 'visibility' },
  eyeOff: { ios: 'eye.slash', android: 'visibility_off' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh' },
  alert: { ios: 'exclamationmark.circle', android: 'error' },
  lock: { ios: 'lock', android: 'lock' },
  locate: { ios: 'location.fill', android: 'my_location' },
  up: { ios: 'chevron.up', android: 'keyboard_arrow_up' },
  down: { ios: 'chevron.down', android: 'keyboard_arrow_down' },
  filter: { ios: 'line.3.horizontal.decrease', android: 'filter_list' },
} as const;

export type IconName = keyof typeof ICONS;
