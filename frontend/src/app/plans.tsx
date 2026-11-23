import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsButton } from '@/components/design-system/as-button';
import { DSColors, DSRadius, DSSpacing, DSText } from '@/constants/design-system';
import { ApiError, type Plan } from '@/lib/api';
import { useAuth } from '@/providers/auth-context';

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
    features: ['1 racha ativo por semana', 'Até 20 participantes por evento', 'Sem torneios'],
  },
  {
    id: 'casual',
    name: 'Casual',
    price: 'R$ 19,90',
    period: '/mês',
    features: ['Rachas ilimitados', 'Até 40 participantes por evento', 'Sem torneios'],
  },
  {
    id: 'intermediario',
    name: 'Intermediário',
    price: 'R$ 49,90',
    period: '/mês',
    features: [
      'Tudo do plano Casual',
      'Até 80 participantes por evento',
      'Torneios com chaveamento',
    ],
  },
  {
    id: 'arena',
    name: 'Arena',
    price: 'R$ 129,90',
    period: '/mês',
    features: [
      'Tudo do plano Intermediário',
      'Participantes ilimitados',
      'Torneios ilimitados',
      'Suporte prioritário',
    ],
  },
];

export default function PlansScreen() {
  const { user, updatePlan } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [error, setError] = useState('');

  async function handleSelect(plan: Plan) {
    if (plan === user?.plan) return;
    setError('');
    setLoadingPlan(plan);
    try {
      await updatePlan(plan);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível mudar de plano');
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Voltar">
          <Text style={styles.backLabel}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Planos</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Escolha o plano que faz mais sentido pra como você organiza seus eventos.
        </Text>

        {error ? (
          <View style={styles.formError}>
            <Text style={styles.formErrorText}>{error}</Text>
          </View>
        ) : null}

        {PLANS.map((plan) => {
          const isCurrent = plan.id === user?.plan;
          return (
            <View key={plan.id} style={[styles.card, isCurrent && styles.cardCurrent]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{plan.name}</Text>
                {isCurrent && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Plano atual</Text>
                  </View>
                )}
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{plan.price}</Text>
                <Text style={styles.period}>{plan.period}</Text>
              </View>
              <View style={styles.features}>
                {plan.features.map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <Text style={styles.featureBullet}>✓</Text>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
              <AsButton
                label={isCurrent ? 'Plano atual' : loadingPlan === plan.id ? 'Mudando...' : 'Selecionar'}
                variant={isCurrent ? 'secondary' : 'primary'}
                disabled={isCurrent || loadingPlan !== null}
                loading={loadingPlan === plan.id}
                onPress={() => handleSelect(plan.id)}
              />
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DSColors.surface2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: DSSpacing[2],
    backgroundColor: DSColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: DSColors.line,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  backLabel: { fontSize: 24, fontWeight: '800', color: DSColors.ink },
  headerTitle: { fontSize: DSText.xl, fontWeight: '800', letterSpacing: -0.6, color: DSColors.ink },
  content: { padding: DSSpacing[4], gap: DSSpacing[3] },
  subtitle: {
    fontSize: DSText.sm,
    fontWeight: '600',
    color: DSColors.inkSecondary,
    marginBottom: DSSpacing[1],
  },
  formError: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: DSColors.dangerTint,
  },
  formErrorText: {
    fontSize: DSText.sm,
    fontWeight: '700',
    color: DSColors.danger,
    textAlign: 'center',
  },
  card: {
    backgroundColor: DSColors.surface,
    borderRadius: DSRadius.xl,
    borderWidth: 1,
    borderColor: DSColors.line,
    padding: DSSpacing[4],
    gap: DSSpacing[3],
  },
  cardCurrent: {
    borderColor: DSColors.primary,
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardName: {
    fontSize: DSText.lg,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: DSColors.ink,
  },
  currentBadge: {
    paddingHorizontal: 10,
    height: 24,
    borderRadius: DSRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.primaryTint,
  },
  currentBadgeText: {
    fontSize: DSText.xs,
    fontWeight: '800',
    color: DSColors.primary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  price: {
    fontSize: DSText['2xl'],
    fontWeight: '800',
    letterSpacing: -0.6,
    color: DSColors.ink,
  },
  period: {
    fontSize: DSText.sm,
    fontWeight: '700',
    color: DSColors.inkSecondary,
    marginBottom: 4,
  },
  features: {
    gap: 6,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  featureBullet: {
    fontSize: DSText.sm,
    fontWeight: '800',
    color: DSColors.primary,
  },
  featureText: {
    flex: 1,
    fontSize: DSText.sm,
    fontWeight: '600',
    color: DSColors.ink,
    lineHeight: 19,
  },
});
