import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ui/Header';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { colors, radius, shadows } from '@/constants/design';
import { apiErrorMessage } from '@/lib/api';
import { postAiChat, fetchAiChatSessions } from '@/lib/ai';
import type { ChatTurn } from '@/lib/ai';
import type { Product } from '@/lib/types';
import { cartItemCount, cartSubtotal, useCartStore } from '@/store/cart';

export default function AssistantScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addItem = useCartStore((state) => state.addItem);
  const items = useCartStore((state) => state.items);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [booting, setBooting] = useState(true);
  const [addingIds, setAddingIds] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchAiChatSessions()
        .then((sessions) => {
          if (sessions.length === 0) return;
          const latest = sessions[0];
          setSessionId(latest.id);
          setTurns(latest.messages);
        })
        .catch(() => {
          // History is optional; a fresh conversation starts below.
        })
        .finally(() => setBooting(false));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (turns.length > 0) {
      // Auto-scroll roughly to the latest turn.
      const timer = setTimeout(() => {
        void scrollRef.current?.scrollToEnd({ animated: true });
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [turns.length, sending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    const optimistic: ChatTurn = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: message,
      cartProposal: [],
      createdAt: new Date().toISOString(),
    };
    setTurns((current) => [...current, optimistic]);
    setDraft('');
    try {
      const reply = await postAiChat(message, sessionId || undefined);
      setSessionId(reply.sessionId);
      setTurns((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: reply.reply,
          cartProposal: reply.cartItems,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (caught) {
      setTurns((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: apiErrorMessage(caught) || 'The assistant is unavailable right now.',
          cartProposal: [],
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  /** Add a proposed cart item: fetch the real product, then add N times. */
  async function addProposal(proposalId: string, entries: { productId: string; quantity: number }[]) {
    if (addingIds.includes(proposalId)) return;
    setAddingIds((current) => [...current, proposalId]);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      for (const entry of entries) {
        const product = await fetchProduct(entry.productId);
        if (!product) continue;
        for (let i = 0; i < entry.quantity; i += 1) addItem(product);
      }
    } finally {
      setAddingIds((current) => current.filter((id) => id !== proposalId));
    }
  }

  const count = cartItemCount(items);
  const subtotal = cartSubtotal(items);

  return (
    <View style={styles.fill}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader
          title="LocalMart Assistant"
          subtitle="Shopping help that turns into a cart"
          onBack={() => router.back()}
        />
      </View>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={96}
      >
        {booting ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.feed}
            showsVerticalScrollIndicator={false}
          >
            {turns.length === 0 ? (
              <View style={[styles.bubbleAssistant, styles.intro]}>
                <Ionicons name="sparkles" size={16} color={colors.primaryDark} />
                <AppText variant="body" tone="muted">
                  {SUGGESTIONS.title}
                </AppText>
                <View style={styles.suggestionRow}>
                  {SUGGESTIONS.chips.map((chip) => (
                    <Pressable
                      key={chip}
                      accessibilityRole="button"
                      accessibilityLabel={`Ask about ${chip}`}
                      onPress={() => void send(chip)}
                      style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.85 }]}
                    >
                      <AppText style={styles.suggestionText}>{chip}</AppText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {turns.map((turn) => (
              <View
                key={turn.id}
                style={turn.role === 'user' ? styles.rowUser : styles.rowAssistant}
              >
                <View
                  style={
                    turn.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant
                  }
                >
                  <AppText
                    variant="body"
                    style={turn.role === 'user' ? { color: colors.white } : undefined}
                  >
                    {turn.content}
                  </AppText>
                </View>
                {turn.role === 'assistant' && turn.cartProposal.length > 0 ? (
                  <Button
                    label={
                      addingIds.includes(turn.id)
                        ? 'Adding…'
                        : `Add ${turn.cartProposal.length} to cart`
                    }
                    icon="basket-outline"
                    variant="secondary"
                    onPress={() => void addProposal(turn.id, turn.cartProposal)}
                    style={styles.addCartButton}
                  />
                ) : null}
              </View>
            ))}

            {sending ? (
              <View style={styles.rowAssistant}>
                <View style={[styles.bubbleAssistant, styles.typing]}>
                  <ActivityIndicator size="small" color={colors.primaryDark} />
                  <AppText variant="caption" tone="muted">
                    Checking the shelves…
                  </AppText>
                </View>
              </View>
            ) : null}
          </ScrollView>
        )}

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask for anything — “dinner under ₹300”"
            placeholderTextColor={colors.subtle}
            style={styles.input}
            accessibilityLabel="Message the assistant"
            multiline
            editable={!sending}
            onSubmitEditing={() => void send(draft)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={() => void send(draft)}
            disabled={sending || draft.trim().length < 2}
            style={({ pressed }) => [
              styles.sendButton,
              (sending || draft.trim().length < 2) && styles.sendDisabled,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Ionicons name="arrow-up" size={19} color={colors.white} />
          </Pressable>
        </View>

        {count > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View cart"
            onPress={() => router.push('/cart')}
            style={({ pressed }) => [styles.cartBar, pressed && { opacity: 0.95 }]}
          >
            <Ionicons name="basket" size={17} color={colors.white} />
            <AppText variant="meta" tone="white" style={{ fontWeight: '800' }}>
              {count} {count === 1 ? 'item' : 'items'} · ₹{subtotal.toFixed(0)}
            </AppText>
            <View style={{ flex: 1 }} />
            <AppText variant="meta" tone="white" style={{ fontWeight: '700' }}>
              View cart →
            </AppText>
          </Pressable>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

async function fetchProduct(productId: string): Promise<Product | null> {
  try {
    const { apiRequest } = await import('@/lib/api');
    return await apiRequest<Product>(`/products/${productId}`, { auth: false });
  } catch {
    return null;
  }
}

const SUGGESTIONS = {
  title:
    'Namaste! Tell me what you are cooking or what you are out of — I will pick the shelves for you and build a one-tap cart.',
  chips: ['Weekly veggies', 'Protein for dinner', 'Something sweet', 'Breakfast staples'],
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  feed: { padding: 16, paddingBottom: 24, gap: 12 },
  rowUser: { flexDirection: 'row', justifyContent: 'flex-end' },
  rowAssistant: { gap: 8 },
  bubbleUser: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.lg,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '82%',
  },
  bubbleAssistant: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '88%',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  intro: { gap: 10 },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestion: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  suggestionText: { color: colors.primaryDark, fontWeight: '700', fontSize: 12 },
  addCartButton: { alignSelf: 'flex-start', maxWidth: '88%' },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 14.5,
    color: colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryDeep,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
