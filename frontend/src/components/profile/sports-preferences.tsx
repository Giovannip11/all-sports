import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AsBanner } from '@/components/design-system/as-banner';
import { AsButton } from '@/components/design-system/as-button';
import { AsChip } from '@/components/design-system/as-chip';
import { AsIconButton } from '@/components/design-system/as-icon-button';
import { AsSegmented } from '@/components/design-system/as-segmented';
import { DSRadius, DSSpacing, DSType, type DSColorSet } from '@/constants/design-system';
import {
  SKILL_LABEL,
  SPORT_KEYS,
  SPORT_TYPES,
  type SkillLevel,
  type SportKey,
} from '@/constants/discover';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { useDSColors } from '@/providers/theme-context';

type Item = { sport: SportKey; skill_level: SkillLevel };

// Rótulo curto no seletor (cabe em 3 colunas no celular); o leitor de tela
// ouve o nome completo pelo accessibilityLabel.
const SKILL_SHORT: Record<SkillLevel, string> = {
  beginner: 'Iniciante',
  intermediate: 'Médio',
  advanced: 'Avançado',
};
const SKILL_OPTIONS = (Object.keys(SKILL_LABEL) as SkillLevel[]).map((value) => ({
  value,
  label: SKILL_SHORT[value],
  full: SKILL_LABEL[value],
}));

/**
 * USER-01 / USER-02 — esportes de interesse em ordem de prioridade, com o
 * nível em cada um. A prioridade ordena a descoberta (mapa e Eventos) e o nível
 * entra no sorteio equilibrado de times.
 */
export function SportsPreferences() {
  const { mySports, saveMySports } = useAuth();
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const saved = useMemo<Item[]>(
    () =>
      mySports
        .filter((s): s is typeof s & { sport: SportKey } => s.sport in SPORT_TYPES)
        .map((s) => ({ sport: s.sport, skill_level: s.skill_level })),
    [mySports],
  );
  const [items, setItems] = useState<Item[]>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Quando as preferências chegam do servidor depois de a tela abrir (ou são
  // salvas), o rascunho volta a refletir o que está gravado.
  const [syncedWith, setSyncedWith] = useState(saved);
  if (syncedWith !== saved) {
    setSyncedWith(saved);
    setItems(saved);
  }

  const dirty = JSON.stringify(items) !== JSON.stringify(saved);
  const available = SPORT_KEYS.filter((key) => !items.some((i) => i.sport === key));

  function update(next: Item[]) {
    setItems(next);
    setMessage('');
    setError('');
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await saveMySports(items);
      setMessage(
        items.length
          ? 'Preferências salvas. O mapa e a lista de eventos mostram primeiro esses esportes.'
          : 'Preferências removidas.',
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar seus esportes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.help}>
        Toque para adicionar. O primeiro da lista é o seu principal: ele aparece primeiro no mapa e
        em Eventos. Informe seu nível para os times saírem equilibrados.
      </Text>

      {items.length === 0 ? (
        <Text style={styles.empty}>Nenhum esporte escolhido ainda.</Text>
      ) : (
        items.map((item, index) => {
          const info = SPORT_TYPES[item.sport];
          return (
            <View key={item.sport} style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.position}>{index + 1}</Text>
                <View style={[styles.dot, { backgroundColor: info.color }]} />
                <Text style={styles.sportName}>{info.label}</Text>
                <AsIconButton
                  icon="up"
                  label={`Subir ${info.label} na prioridade`}
                  disabled={index === 0}
                  onPress={() => move(index, -1)}
                />
                <AsIconButton
                  icon="down"
                  label={`Descer ${info.label} na prioridade`}
                  disabled={index === items.length - 1}
                  onPress={() => move(index, 1)}
                />
                <AsIconButton
                  icon="close"
                  label={`Remover ${info.label}`}
                  onPress={() => update(items.filter((i) => i.sport !== item.sport))}
                />
              </View>
              <AsSegmented
                value={item.skill_level}
                onChange={(skill_level) =>
                  update(items.map((i) => (i.sport === item.sport ? { ...i, skill_level } : i)))
                }
                options={SKILL_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                  accessibilityLabel: `Nível em ${info.label}: ${o.full}`,
                }))}
              />
            </View>
          );
        })
      )}

      {available.length > 0 && (
        <View style={styles.chips}>
          {available.map((key) => (
            <AsChip
              key={key}
              label={`+ ${SPORT_TYPES[key].label}`}
              dotColor={SPORT_TYPES[key].color}
              active={false}
              onPress={() => update([...items, { sport: key, skill_level: 'beginner' }])}
            />
          ))}
        </View>
      )}

      {error ? <AsBanner tone="error" message={error} /> : null}
      {message ? <AsBanner tone="success" message={message} /> : null}

      <AsButton
        label={saving ? 'Salvando...' : 'Salvar esportes'}
        variant={dirty ? 'primary' : 'secondary'}
        block
        loading={saving}
        disabled={!dirty}
        onPress={handleSave}
      />
    </View>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    wrap: { gap: DSSpacing[3] },
    help: { ...DSType.meta, color: DSColors.inkSecondary },
    empty: { ...DSType.small, color: DSColors.inkSecondary },
    row: {
      gap: DSSpacing[2],
      padding: DSSpacing[3],
      borderRadius: DSRadius.md,
      borderWidth: 1,
      borderColor: DSColors.line,
      backgroundColor: DSColors.surface,
    },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: DSSpacing[1] },
    position: {
      ...DSType.scoreSm,
      width: 24,
      textAlign: 'center',
      color: DSColors.primary,
    },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: DSSpacing[1] },
    sportName: { ...DSType.bodyStrong, flex: 1, color: DSColors.ink },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: DSSpacing[2] },
  });
}
