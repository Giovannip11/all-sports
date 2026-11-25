import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsBanner } from '@/components/design-system/as-banner';
import { AsEmpty } from '@/components/design-system/as-empty';
import { AsHeader } from '@/components/design-system/as-header';
import { AsIconButton } from '@/components/design-system/as-icon-button';
import { AsColumn } from '@/components/design-system/as-layout';
import { DSRadius, DSSpacing, DSType, type DSColorSet } from '@/constants/design-system';
import { ApiError, type ApiMessage } from '@/lib/api';
import * as api from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { useDSColors } from '@/providers/theme-context';
import { formatTime } from '@/utils/format';

const POLL_INTERVAL_MS = 4000;

export default function EventChatScreen() {
  const { eventId, title } = useLocalSearchParams<{ eventId: string; title?: string }>();
  const { accessToken } = useAuth();
  const colors = useDSColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!accessToken || !eventId) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const data = await api.listMessages(accessToken, eventId);
        setMessages(data);
        setError('');
      } catch (err) {
        if (!silent) setError(err instanceof ApiError ? err.message : 'Erro ao carregar o chat');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [accessToken, eventId],
  );

  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(() => load(true), POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }, [load]),
  );

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || !accessToken || !eventId) return;
    setSending(true);
    setDraft('');
    try {
      const message = await api.sendMessage(accessToken, eventId, body);
      // A busca automática (a cada 4 s) pode já ter trazido essa mensagem.
      setMessages((current) =>
        current.some((m) => m.id === message.id) ? current : [...current, message],
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar a mensagem');
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  const canSend = !sending && !!draft.trim();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AsHeader title={title || 'Chat do evento'} bordered />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
            <AsColumn style={styles.column}>
              {messages.length === 0 && (
                <AsEmpty
                  icon="chat"
                  title="Nenhuma mensagem ainda"
                  body="Combine horário, uniforme e quem leva a bola. Todos os inscritos leem aqui."
                />
              )}
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[styles.bubbleRow, message.is_mine && styles.bubbleRowMine]}>
                  <View style={[styles.bubble, message.is_mine && styles.bubbleMine]}>
                    {!message.is_mine && (
                      <Text style={styles.senderName}>{message.sender_name}</Text>
                    )}
                    <Text style={[styles.bubbleText, message.is_mine && styles.bubbleTextMine]}>
                      {message.body}
                    </Text>
                    <Text style={[styles.bubbleTime, message.is_mine && styles.bubbleTimeMine]}>
                      {formatTime(message.created_at)}
                    </Text>
                  </View>
                </View>
              ))}
            </AsColumn>
          </ScrollView>
        )}

        {error ? <AsBanner tone="error" message={error} style={styles.error} /> : null}

        <SafeAreaView edges={['bottom']} style={styles.composerWrap}>
          <AsColumn style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder="Escreva uma mensagem..."
              placeholderTextColor={colors.inkTertiary}
              accessibilityLabel="Mensagem"
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={4000}
              // Na web/teclado físico: Enter envia, Shift+Enter quebra linha.
              onKeyPress={(e) => {
                // No celular o Enter do teclado continua quebrando linha.
                if (Platform.OS !== 'web') return;
                const native = e.nativeEvent as { key: string; shiftKey?: boolean };
                if (native.key === 'Enter' && !native.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <AsIconButton
              icon="send"
              label="Enviar mensagem"
              variant="primary"
              onPress={handleSend}
              disabled={!canSend}
            />
          </AsColumn>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: DSColors.bg },
    flex: { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: DSSpacing[4], flexGrow: 1 },
    column: { gap: DSSpacing[2] },
    bubbleRow: { flexDirection: 'row' },
    bubbleRowMine: { justifyContent: 'flex-end' },
    bubble: {
      maxWidth: '80%',
      backgroundColor: DSColors.surface,
      borderRadius: DSRadius.md,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: DSColors.line,
      paddingHorizontal: DSSpacing[3],
      paddingVertical: DSSpacing[2],
      gap: 2,
    },
    bubbleMine: {
      backgroundColor: DSColors.primary,
      borderColor: DSColors.primary,
      borderBottomLeftRadius: DSRadius.md,
      borderBottomRightRadius: 4,
    },
    senderName: { ...DSType.meta, fontWeight: '700', color: DSColors.primary },
    bubbleText: { ...DSType.small, color: DSColors.ink },
    bubbleTextMine: { color: DSColors.onPrimary },
    bubbleTime: {
      ...DSType.meta,
      fontSize: 11,
      lineHeight: 14,
      color: DSColors.inkSecondary,
      alignSelf: 'flex-end',
    },
    bubbleTimeMine: { color: DSColors.onPrimary, opacity: 0.85 },
    error: { marginHorizontal: DSSpacing[4], marginBottom: DSSpacing[2] },
    composerWrap: {
      borderTopWidth: 1,
      borderTopColor: DSColors.line,
      backgroundColor: DSColors.surface,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: DSSpacing[2],
      padding: DSSpacing[3],
    },
    input: {
      ...DSType.small,
      flex: 1,
      maxHeight: 120,
      minHeight: 44,
      borderRadius: DSRadius.md,
      borderWidth: 1,
      borderColor: DSColors.lineStrong,
      backgroundColor: DSColors.surface,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 12,
      color: DSColors.ink,
    },
  });
}
