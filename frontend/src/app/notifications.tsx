import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DSColors, DSSpacing, DSText } from '@/constants/design-system';
import { ApiError, type ApiNotification } from '@/lib/api';
import * as api from '@/lib/api';
import { useAuth } from '@/providers/auth-context';

function formatRelative(iso: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  return `há ${diffDays} d`;
}

export default function NotificationsScreen() {
  const { accessToken } = useAuth();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setNotifications(await api.listNotifications(accessToken));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handlePress(notification: ApiNotification) {
    if (!accessToken || notification.read) return;
    try {
      await api.markNotificationRead(accessToken, notification.id);
      setNotifications((current) =>
        current.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
      );
    } catch {
      // best-effort — UI stays usable even if marking as read fails
    }
  }

  async function handleMarkAllRead() {
    if (!accessToken) return;
    try {
      await api.markAllNotificationsRead(accessToken);
      setNotifications((current) => current.map((n) => ({ ...n, read: true })));
    } catch {
      // best-effort
    }
  }

  const hasUnread = notifications.some((n) => !n.read);

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
        <Text style={styles.title}>Notificações</Text>
        {hasUnread && (
          <Pressable onPress={handleMarkAllRead} hitSlop={8}>
            <Text style={styles.markAll}>Marcar todas</Text>
          </Pressable>
        )}
      </View>

      {error ? (
        <View style={styles.formError}>
          <Text style={styles.formErrorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={DSColors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {notifications.length === 0 && (
            <Text style={styles.empty}>Você não tem notificações.</Text>
          )}
          {notifications.map((notification) => (
            <Pressable
              key={notification.id}
              style={[styles.row, !notification.read && styles.rowUnread]}
              onPress={() => handlePress(notification)}>
              {!notification.read && <View style={styles.dot} />}
              <View style={styles.rowBody}>
                <Text style={styles.message}>{notification.message}</Text>
                <Text style={styles.time}>{formatRelative(notification.created_at)}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DSColors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DSSpacing[2],
    minHeight: 56,
    paddingHorizontal: DSSpacing[2],
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  backLabel: { fontSize: 24, fontWeight: '800', color: DSColors.ink },
  title: {
    flex: 1,
    fontSize: DSText.xl,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: DSColors.ink,
  },
  markAll: {
    fontSize: DSText.sm,
    fontWeight: '800',
    color: DSColors.primary,
    marginRight: DSSpacing[2],
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: DSSpacing[4], gap: 4 },
  empty: {
    textAlign: 'center',
    marginTop: DSSpacing[6],
    fontSize: DSText.sm,
    fontWeight: '600',
    color: DSColors.inkSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  rowUnread: {
    backgroundColor: DSColors.primaryTint,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DSColors.primary,
    marginTop: 6,
  },
  rowBody: { flex: 1, gap: 2 },
  message: { fontSize: DSText.sm, fontWeight: '600', color: DSColors.ink, lineHeight: 19 },
  time: { fontSize: DSText.xs, fontWeight: '700', color: DSColors.inkSecondary },
  formError: {
    margin: DSSpacing[4],
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
});
