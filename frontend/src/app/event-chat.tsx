import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DSRadius, DSSpacing, DSText, type DSColorSet } from '@/constants/design-system';
import { ApiError, type ApiMessage } from '@/lib/api';
import * as api from '@/lib/api';
import { useAuth } from '@/providers/auth-context';
import { useDSColors } from '@/providers/theme-context';

const POLL_INTERVAL_MS = 4000;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

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
      setMessages((current) => [...current, message]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar a mensagem');
      setDraft(body);
    } finally {
      setSending(false);
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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title || 'Chat do evento'}
        </Text>
      </View>

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
            {messages.length === 0 && (
              <Text style={styles.empty}>Nenhuma mensagem ainda. Diga oi 👋</Text>
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
          </ScrollView>
        )}

        {error ? (
          <View style={styles.formError}>
            <Text style={styles.formErrorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Escreva uma mensagem..."
            placeholderTextColor={colors.inkTertiary}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={4000}
          />
          <Pressable
            onPress={handleSend}
            disabled={sending || !draft.trim()}
            style={[styles.sendButton, (sending || !draft.trim()) && styles.sendButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensagem">
            <Text style={styles.sendButtonText}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(DSColors: DSColorSet) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: DSColors.surface2 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DSSpacing[2],
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
  headerTitle: {
    flex: 1,
    fontSize: DSText.lg,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: DSColors.ink,
  },
  content: { padding: DSSpacing[4], gap: 10, flexGrow: 1 },
  empty: {
    textAlign: 'center',
    marginTop: DSSpacing[6],
    fontSize: DSText.sm,
    fontWeight: '600',
    color: DSColors.inkSecondary,
  },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    backgroundColor: DSColors.surface,
    borderRadius: DSRadius.lg,
    borderWidth: 1,
    borderColor: DSColors.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  bubbleMine: {
    backgroundColor: DSColors.primary,
    borderColor: DSColors.primary,
  },
  senderName: {
    fontSize: DSText.xs,
    fontWeight: '800',
    color: DSColors.primary,
  },
  bubbleText: { fontSize: DSText.sm, fontWeight: '600', color: DSColors.ink, lineHeight: 19 },
  bubbleTextMine: { color: DSColors.inverse },
  bubbleTime: {
    fontSize: 10,
    fontWeight: '700',
    color: DSColors.inkTertiary,
    alignSelf: 'flex-end',
  },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },
  formError: {
    marginHorizontal: DSSpacing[4],
    marginBottom: DSSpacing[2],
    padding: 10,
    borderRadius: 8,
    backgroundColor: DSColors.dangerTint,
  },
  formErrorText: {
    fontSize: DSText.xs,
    fontWeight: '700',
    color: DSColors.danger,
    textAlign: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: DSSpacing[3],
    borderTopWidth: 1,
    borderTopColor: DSColors.line,
    backgroundColor: DSColors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 40,
    borderRadius: DSRadius.lg,
    borderWidth: 1,
    borderColor: DSColors.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: DSText.sm,
    color: DSColors.ink,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DSColors.accent,
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { fontSize: 16, color: DSColors.inverse, fontWeight: '800' },
  });
}
