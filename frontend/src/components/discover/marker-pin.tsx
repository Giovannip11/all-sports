import { StyleSheet, Text, View } from 'react-native';

import { DSColors } from '@/constants/design-system';

export type MarkerPinProps = {
  color: string;
  label: string;
  selected?: boolean;
  dashed?: boolean;
};

/** Bare pin visual for use as a react-native-maps <Marker> child — positioning is
 * handled by the Marker's `coordinate`/`anchor`, not by this component. */
export function MarkerPin({ color, label, selected, dashed }: MarkerPinProps) {
  const size = selected ? 40 : 30;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.teardrop,
          {
            width: size,
            height: size,
            backgroundColor: color,
            borderStyle: dashed ? 'dashed' : 'solid',
          },
          selected && styles.teardropSelected,
        ]}>
        <Text style={[styles.label, { fontSize: selected ? 14 : 11 }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  teardrop: {
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    borderBottomLeftRadius: 2,
    borderWidth: 2,
    borderColor: DSColors.inverse,
    transform: [{ rotate: '-45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  teardropSelected: {
    borderWidth: 3,
  },
  label: {
    color: DSColors.inverse,
    fontWeight: '800',
    transform: [{ rotate: '45deg' }],
  },
});
