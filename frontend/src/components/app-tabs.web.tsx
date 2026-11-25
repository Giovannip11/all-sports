import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsIcon, type IconName } from '@/components/design-system/as-icon';
import { DSLayout, DSRadius, DSSpacing, DSType, type DSColorSet } from '@/constants/design-system';
import { useDSColors } from '@/providers/theme-context';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/main" asChild>
            <TabButton icon="map">Mapa</TabButton>
          </TabTrigger>
          <TabTrigger name="events" href="/main/events" asChild>
            <TabButton icon="calendar">Eventos</TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/main/profile" asChild>
            <TabButton icon="user">Perfil</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function TabButton({
  children,
  icon,
  isFocused,
  ...props
}: TabTriggerSlotProps & { icon: IconName }) {
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const color = isFocused ? colors.primary : colors.inkSecondary;
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      style={styles.tabButton}>
      <View style={[styles.iconPill, isFocused && styles.iconPillActive]}>
        <AsIcon name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.tabLabel, { color }, isFocused && styles.tabLabelActive]}>
        {children}
      </Text>
    </Pressable>
  );
}

function CustomTabList(props: TabListProps) {
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <SafeAreaView edges={['bottom']} style={styles.bar}>
      <View {...props} style={styles.barInner} />
    </SafeAreaView>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    bar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: DSColors.surface,
      borderTopWidth: 1,
      borderTopColor: DSColors.line,
    },
    barInner: {
      flexDirection: 'row',
      maxWidth: DSLayout.maxForm,
      width: '100%',
      alignSelf: 'center',
      paddingVertical: DSSpacing[1],
      paddingHorizontal: DSSpacing[2],
    },
    tabButton: {
      flex: 1,
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    iconPill: {
      width: 56,
      height: 30,
      borderRadius: DSRadius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconPillActive: {
      backgroundColor: DSColors.primaryTint,
    },
    tabLabel: {
      ...DSType.meta,
    },
    tabLabelActive: {
      fontWeight: '700',
    },
  });
}
