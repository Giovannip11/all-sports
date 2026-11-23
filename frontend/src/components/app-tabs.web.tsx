import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DSSpacing, DSText, type DSColorSet } from '@/constants/design-system';
import { useDSColors } from '@/providers/theme-context';

const TAB_ICONS = {
  home: '🏠',
  events: '📅',
  profile: '👤',
} as const;

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/main" asChild>
            <TabButton icon={TAB_ICONS.home}>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="events" href="/main/events" asChild>
            <TabButton icon={TAB_ICONS.events}>Eventos</TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/main/profile" asChild>
            <TabButton icon={TAB_ICONS.profile}>Perfil</TabButton>
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
}: TabTriggerSlotProps & { icon: string }) {
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable {...props} style={styles.tabButton}>
      <Text style={[styles.tabIcon, isFocused && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{children}</Text>
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
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
      paddingVertical: DSSpacing[2],
      paddingHorizontal: DSSpacing[2],
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
      paddingVertical: DSSpacing[1],
      borderRadius: 10,
    },
    tabIcon: {
      fontSize: 18,
      opacity: 0.55,
    },
    tabIconActive: {
      opacity: 1,
    },
    tabLabel: {
      fontSize: DSText.xs,
      fontWeight: '700',
      color: DSColors.inkSecondary,
    },
    tabLabelActive: {
      color: DSColors.primary,
      fontWeight: '800',
    },
  });
}
