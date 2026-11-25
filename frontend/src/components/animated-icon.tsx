import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AsLogo } from '@/components/design-system/as-logo';
import { DSColors } from '@/constants/design-system';

const DURATION = 450;

/**
 * Emenda o splash nativo (verde da marca + selo) com o app: mesma cor e mesmo
 * selo, que somem num fade curto. Sem gradiente nem escala exagerada.
 */
export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const fadeOut = new Keyframe({
    0: { opacity: 1 },
    30: { opacity: 1 },
    100: { opacity: 0, easing: Easing.out(Easing.quad) },
  });

  const logo = <AsLogo size={160} />;

  return animate ? (
    <Animated.View
      entering={fadeOut.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.splashOverlay}
      pointerEvents="none">
      {logo}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setAnimate(true);
        });
      }}
      style={styles.splashOverlay}>
      {logo}
    </View>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: DSColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
