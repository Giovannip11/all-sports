import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { DSRadius } from '@/constants/design-system';

export type AsLogoProps = {
  size?: number;
};

/** Selo da marca (assets/brand/icon-stack-green.svg), renderizado pelo expo-image. */
export function AsLogo({ size = 88 }: AsLogoProps) {
  return (
    <Image
      source={require('@/assets/brand/icon-stack-green.svg')}
      style={[styles.logo, { width: size, height: size }]}
      contentFit="contain"
      accessible
      accessibilityLabel="All Sports"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    borderRadius: DSRadius.lg,
  },
});
