import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsBanner } from '@/components/design-system/as-banner';
import { AsButton } from '@/components/design-system/as-button';
import { AsEmpty } from '@/components/design-system/as-empty';
import { AsHeader } from '@/components/design-system/as-header';
import { AsIcon, type IconName } from '@/components/design-system/as-icon';
import { AsColumn } from '@/components/design-system/as-layout';
import { DSRadius, DSSpacing, DSType, type DSColorSet } from '@/constants/design-system';
import { ApiError, type ApiNotification } from '@/lib/api';
import * as api from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { useDSColors } from '@/providers/theme-context';
import { formatRelative } from '@/utils/format';

/** Ícone pelo tipo da notificação (o tipo vem do backend como texto livre). */
function iconFor(type: string): IconName {
  const t = type.toLowerCase();
  if (t.includes('cancel')) return 'close';
  if (t.includes('chat') || t.includes('message')) return 'chat';
  if (t.includes('team') || t.includes('draw')) return 'shuffle';
  if (t.includes('join') || t.includes('confirm') || t.includes('presence')) return 'check';
  if (t.includes('update') || t.includes('change')) return 'edit';
  return 'bell';
}

export default function NotificationsScreen() {
  const { accessToken } = useAuth();
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    if (!accessToken) return;
    if (!notification.read) {
      try {
        await api.markNotificationRead(accessToken, notification.id);
        setNotifications((current) =>
          current.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
        );
      } catch {
        // best-effort — UI stays usable even if marking as read fails
      }
    }
    // Antes o toque só marcava como lida; agora também abre o evento do aviso.
    if (notification.event_id) router.push(`/event/${notification.event_id}`);
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
      <AsHeader
        title="Notificações"
        bordered
        right={
          hasUnread ? (
            <AsButton
              label="Marcar todas"
              accessibilityLabel="Marcar todas como lidas"
              icon="check"
              variant="ghost"
              size="sm"
              onPress={handleMarkAllRead}
            />
          ) : null
        }
      />

      {loading && notifications.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <AsColumn style={styles.list}>
            {error ? (
              <AsBanner
                tone="error"
                message={error}
                action={{ label: 'Tentar de novo', onPress: load }}
              />
            ) : null}

            {!error && notifications.length === 0 && (
              <AsEmpty
                icon="bell"
                title="Tudo em dia"
                body="Avisos de inscrição, mudanças e cancelamentos de eventos aparecem aqui."
              />
            )}

            {notifications.map((notification) => (
              <Pressable
                key={notification.id}
                style={({ pressed }) => [
                  styles.row,
                  !notification.read && styles.rowUnread,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => handlePress(notification)}
                accessibilityRole="button"
                accessibilityLabel={`${notification.read ? '' : 'Não lida. '}${notification.title ? `${notification.title}. ` : ''}${notification.message}, ${formatRelative(notification.created_at)}`}
                accessibilityHint={
                  notification.event_id
                    ? 'Abre o evento'
                    : notification.read
                      ? undefined
                      : 'Marca como lida'
                }>
                <View style={[styles.icon, !notification.read && styles.iconUnread]}>
                  <AsIcon
                    name={iconFor(notification.type)}
                    size={20}
                    color={notification.read ? colors.inkSecondary : colors.primary}
                  />
                </View>
                <View style={styles.rowBody}>
                  {notification.title ? (
                    <Text style={styles.titleText}>{notification.title}</Text>
                  ) : null}
                  <Text style={[styles.message, !notification.read && styles.messageUnread]}>
                    {notification.message}
                  </Text>
                  <Text style={styles.time}>{formatRelative(notification.created_at)}</Text>
                </View>
                {!notification.read && <View style={styles.dot} />}
              </Pressable>
            ))}
          </AsColumn>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: DSColors.surface },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: DSSpacing[4], paddingBottom: DSSpacing[7] },
    list: { gap: DSSpacing[1] },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: DSSpacing[3],
      padding: DSSpacing[3],
      borderRadius: DSRadius.md,
    },
    rowUnread: { backgroundColor: DSColors.primaryTint },
    rowPressed: { backgroundColor: DSColors.surface2 },
    icon: {
      width: 40,
      height: 40,
      borderRadius: DSRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: DSColors.surface2,
    },
    iconUnread: { backgroundColor: DSColors.surface },
    rowBody: { flex: 1, gap: 2 },
    titleText: { ...DSType.labelStrong, color: DSColors.ink },
    message: { ...DSType.small, color: DSColors.inkSecondary },
    messageUnread: { color: DSColors.ink },
    time: { ...DSType.meta, color: DSColors.inkSecondary },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: 6,
      backgroundColor: DSColors.primary,
    },
  });
}
