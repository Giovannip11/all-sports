import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DSColors } from '@/constants/design-system';

export type MapPinProps = {
  color: string;
  label: string;
  x: `${number}%`;
  y: `${number}%`;
  selected?: boolean;
  dashed?: boolean;
  caption?: string;
  onPress?: () => void;
};

export function MapPin({ color, label, x, y, selected, dashed, caption, onPress }: MapPinProps) {
  const size = selected ? 40 : 30;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.wrap, { left: x, top: y }]}>
      {caption && (
        <View style={styles.caption}>
          <Text style={styles.captionText} numberOfLines={1}>
            {caption}
          </Text>
        </View>
      )}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -15 }, { translateY: -30 }],
  },
  caption: {
    marginBottom: 4,
    maxWidth: 140,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: DSColors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  captionText: {
    fontSize: 11,
    fontWeight: '800',
    color: DSColors.ink,
    letterSpacing: -0.2,
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
