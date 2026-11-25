import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsBadge } from '@/components/design-system/as-badge';
import { AsBanner } from '@/components/design-system/as-banner';
import { AsButton } from '@/components/design-system/as-button';
import { AsConfirm } from '@/components/design-system/as-confirm';
import { AsHeader } from '@/components/design-system/as-header';
import { AsIcon } from '@/components/design-system/as-icon';
import { AsColumn } from '@/components/design-system/as-layout';
import { DSRadius, DSSpacing, DSType, type DSColorSet } from '@/constants/design-system';
import { ApiError, type Plan } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { useDSColors } from '@/providers/theme-context';

const PLANS: {
  id: Plan;
  name: string;
  price: string;
  period: string;
  features: string[];
}[] = [
  {
    id: 'gratuito',
    name: 'Gratuito',
    price: 'R$ 0',
    period: '/mês',
    // Textos alinhados à matriz de planos do banco (migration 0002 / PLAN-01).
    features: [
      'Ver rachas e torneios no mapa',
      'Participar de eventos e torneios',
      'Chat dos eventos',
    ],
  },
  {
    id: 'casual',
    name: 'Casual',
    price: 'R$ 19,90',
    period: '/mês',
    features: ['Até 2 rachas por semana', 'Até 20 participantes por evento', 'Sorteio de times', 'Sem torneios'],
  },
  {
    id: 'intermediario',
    name: 'Intermediário',
    price: 'R$ 49,90',
    period: '/mês',
    features: [
      'Até 10 rachas por semana',
      'Até 100 participantes por evento',
      'Torneios com chaveamento (até 3 ativos, 32 equipes)',
      'Cobrança de taxa de inscrição',
    ],
  },
  {
    id: 'arena',
    name: 'Arena',
    price: 'R$ 149,90',
    period: '/mês',
    features: [
      'Rachas e participantes ilimitados',
      'Torneios ilimitados e de grande volume',
      'Arenas com múltiplas quadras',
      'Suporte dedicado',
    ],
  },
];

export default function PlansScreen() {
  const { user, updatePlan } = useAuth();
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Só interface: qual plano está com a confirmação aberta.
  const [confirmingPlan, setConfirmingPlan] = useState<Plan | null>(null);

  async function handleSelect(plan: Plan) {
    if (plan === user?.plan) return;
    setError('');
    setNotice('');
    setLoadingPlan(plan);
    try {
      await updatePlan(plan);
      setNotice(`Pronto! Seu plano agora é o ${PLANS.find((p) => p.id === plan)?.name ?? plan}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível mudar de plano');
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AsHeader title="Planos" bordered />

      <ScrollView contentContainerStyle={styles.content}>
        <AsColumn style={styles.column}>
          <Text style={styles.subtitle}>
            Escolha o plano que faz mais sentido pra como você organiza seus eventos.
          </Text>

          {error ? <AsBanner tone="error" message={error} /> : null}
          {notice ? <AsBanner tone="success" message={notice} /> : null}

          {PLANS.map((plan) => {
            const isCurrent = plan.id === user?.plan;
            const confirming = confirmingPlan === plan.id;
            const hasTournaments = plan.features.some((f) => f.startsWith('Torneios'));
            return (
              <View key={plan.id} style={[styles.card, isCurrent && styles.cardCurrent]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardName}>
                    {hasTournaments && <AsIcon name="trophy" size={20} color={colors.ink} />}
                    <Text style={styles.cardNameText}>{plan.name}</Text>
                  </View>
                  {isCurrent && <AsBadge label="Plano atual" tone="accent" />}
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{plan.price}</Text>
                  <Text style={styles.period}>{plan.period}</Text>
                </View>
                <View style={styles.features}>
                  {plan.features.map((feature) => (
                    <View key={feature} style={styles.featureRow}>
                      <AsIcon name="check" size={18} color={colors.primary} />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
                {confirming ? (
                  <AsConfirm
                    message={`Mudar do plano ${PLANS.find((p) => p.id === user?.plan)?.name ?? 'atual'} para o ${plan.name} (${plan.price}${plan.period})?`}
                    cancelLabel="Voltar"
                    confirmLabel={loadingPlan === plan.id ? 'Mudando...' : 'Confirmar'}
                    loading={loadingPlan === plan.id}
                    onCancel={() => setConfirmingPlan(null)}
                    onConfirm={() => handleSelect(plan.id).then(() => setConfirmingPlan(null))}
                  />
                ) : (
                  <AsButton
                    label={isCurrent ? 'Plano atual' : `Escolher ${plan.name}`}
                    variant={isCurrent ? 'secondary' : 'primary'}
                    disabled={isCurrent || loadingPlan !== null}
                    onPress={() => setConfirmingPlan(plan.id)}
                  />
                )}
              </View>
            );
          })}
        </AsColumn>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: DSColors.bg },
    content: { padding: DSSpacing[4], paddingBottom: DSSpacing[7] },
    column: { gap: DSSpacing[3] },
    subtitle: {
      ...DSType.small,
      color: DSColors.inkSecondary,
      marginBottom: DSSpacing[1],
    },
    card: {
      backgroundColor: DSColors.surface,
      borderRadius: DSRadius.md,
      borderWidth: 1,
      borderColor: DSColors.line,
      padding: DSSpacing[4],
      gap: DSSpacing[3],
    },
    cardCurrent: {
      borderColor: DSColors.accent,
      borderWidth: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardName: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DSSpacing[2],
    },
    cardNameText: {
      ...DSType.headline,
      color: DSColors.ink,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    },
    price: {
      ...DSType.display,
      color: DSColors.ink,
      fontVariant: ['tabular-nums'],
    },
    period: {
      ...DSType.label,
      color: DSColors.inkSecondary,
    },
    features: {
      gap: DSSpacing[2],
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: DSSpacing[2],
    },
    featureText: {
      ...DSType.small,
      flex: 1,
      color: DSColors.ink,
    },
  });
}
