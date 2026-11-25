import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AsButton } from '@/components/design-system/as-button';
import { AsChip } from '@/components/design-system/as-chip';
import { DSRadius, DSShadow1, DSSpacing, DSType, type DSColorSet } from '@/constants/design-system';
import { useDSColors } from '@/providers/theme-context';
import {
  DATE_OPTIONS,
  DEFAULT_FILTERS,
  DISTANCE_OPTIONS,
  TIME_OPTIONS,
  activeFilterCount,
  type DiscoveryFilters,
} from '@/utils/discovery';

export type DiscoveryFiltersPanelProps = {
  value: DiscoveryFilters;
  onChange: (next: DiscoveryFilters) => void;
  /** Sem localização não dá para filtrar por distância. */
  hasLocation: boolean;
  onClose: () => void;
  /** Mostra com sombra (flutuando sobre o mapa) ou plano (na lista). */
  floating?: boolean;
};

/** Painel de filtros de data, horário e distância (DISC-03). */
export function DiscoveryFiltersPanel({
  value,
  onChange,
  hasLocation,
  onClose,
  floating,
}: DiscoveryFiltersPanelProps) {
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const count = activeFilterCount(value);

  return (
    <View style={[styles.panel, floating && styles.floating]} accessibilityLabel="Filtros">
      <Group title="Quando" styles={styles}>
        {DATE_OPTIONS.map((o) => (
          <AsChip
            key={o.value}
            label={o.label}
            active={value.date === o.value}
            onPress={() => onChange({ ...value, date: o.value })}
          />
        ))}
      </Group>
      <Group title="Horário" styles={styles}>
        {TIME_OPTIONS.map((o) => (
          <AsChip
            key={o.value}
            label={o.label}
            active={value.time === o.value}
            onPress={() => onChange({ ...value, time: o.value })}
          />
        ))}
      </Group>
      <Group title="Distância" styles={styles}>
        {DISTANCE_OPTIONS.map((o) => (
          <AsChip
            key={String(o.value)}
            label={o.label}
            active={value.distanceKm === o.value}
            onPress={() => onChange({ ...value, distanceKm: o.value })}
          />
        ))}
      </Group>
      {!hasLocation && value.distanceKm !== null && (
        <Text style={styles.warning}>
          Sem sua localização o filtro de distância fica desligado.
        </Text>
      )}
      <View style={styles.actions}>
        <AsButton
          label="Limpar filtros"
          variant="ghost"
          size="sm"
          disabled={count === 0}
          onPress={() => onChange(DEFAULT_FILTERS)}
        />
        <AsButton label="Pronto" size="sm" onPress={onClose} />
      </View>
    </View>
  );
}

function Group({
  title,
  children,
  styles,
}: {
  title: string;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {children}
      </ScrollView>
    </View>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    panel: {
      gap: DSSpacing[3],
      padding: DSSpacing[3],
      borderRadius: DSRadius.md,
      backgroundColor: DSColors.surface,
      borderWidth: 1,
      borderColor: DSColors.line,
    },
    floating: { ...DSShadow1 },
    group: { gap: DSSpacing[1] },
    groupTitle: { ...DSType.labelStrong, color: DSColors.inkSecondary },
    row: { gap: DSSpacing[2] },
    warning: { ...DSType.meta, color: DSColors.warning },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: DSSpacing[2] },
  });
}
