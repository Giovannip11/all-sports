import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

import { ICONS, type IconName } from './icon-names';

export type { IconName } from './icon-names';

export type AsIconProps = {
  name: IconName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
};

type SymbolName = ComponentProps<typeof SymbolView>['name'];

/** Ícone nativo: SF Symbols no iOS, Material Symbols no Android (expo-symbols). */
export function AsIcon({ name, size = 22, color, style }: AsIconProps) {
  const icon = ICONS[name];
  return (
    <SymbolView
      name={{ ios: icon.ios, android: icon.android, web: icon.android } as SymbolName}
      size={size}
      tintColor={color}
      weight="medium"
      style={[{ width: size, height: size }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
