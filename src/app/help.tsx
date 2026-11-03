import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
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
import { colors, radius, shadows } from '@/constants/design';
import { apiErrorMessage } from '@/lib/api';
import { postAiSupport } from '@/lib/ai';
import { translate } from '@/lib/i18n';
import { useLanguageStore } from '@/store/language';

const SUPPORT_EMAIL = 'support@neuracart.app';

const STARTERS = ['help.starter1', 'help.starter2', 'help.starter3', 'help.starter4'];

type Turn = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  articleSlugs: string[];
};

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const language = useLanguageStore((state) => state.language);
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(language, key, vars);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (turns.length === 0) return;
    const timer = setTimeout(() => {
      void scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
    return () => clearTimeout(timer);
  }, [turns.length, sending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setDraft('');
    setTurns((current) => [
      ...current,
      { id: `local-${Date.now()}`, role: 'user', content: message, articleSlugs: [] },
    ]);
    try {
      const reply = await postAiSupport(message);
      setTurns((current) => [
        ...current,
        {
          id: `support-${Date.now()}`,
          role: 'assistant',
          content: reply.reply,
          articleSlugs: reply.articleSlugs,
        },
      ]);
    } catch (caught) {
      setTurns((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content:
            apiErrorMessage(caught) ||
            t('help.fallback', { email: SUPPORT_EMAIL }),
          articleSlugs: [],
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.fill}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader
          title={t('help.title')}
          subtitle={t('help.subtitle')}
          onBack={() => router.back()}
        />
      </View>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={96}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.feed}
          showsVerticalScrollIndicator={false}
        >
          {turns.length === 0 ? (
            <View style={[styles.bubbleAssistant, styles.intro]}>
              <Ionicons name="headset-outline" size={18} color={colors.primaryDark} />
              <AppText variant="body" tone="muted">
                {t('help.intro')}
              </AppText>
              <View style={styles.suggestionRow}>
                {STARTERS.map((starter) => (
                  <Pressable
                    key={starter}
                    accessibilityRole="button"
                    accessibilityLabel={`Ask: ${t(starter)}`}
                    onPress={() => void send(t(starter))}
                    style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.85 }]}
                  >
                    <AppText style={styles.suggestionText}>{t(starter)}</AppText>
                  </Pressable>
                ))}
              </View>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Email support"
                onPress={() =>
                  void Linking.openURL(
                    `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('NeuraCart support')}`,
                  )
                }
                style={styles.emailRow}
              >
                <Ionicons name="mail-outline" size={15} color={colors.primaryDark} />
                <AppText variant="caption" tone="muted">
                  {SUPPORT_EMAIL}
                </AppText>
              </Pressable>
            </View>
          ) : null}

          {turns.map((turn) => (
            <View key={turn.id} style={turn.role === 'user' ? styles.rowUser : styles.rowAssistant}>
              <View style={turn.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}>
                <AppText
                  variant="body"
                  style={turn.role === 'user' ? { color: colors.white } : undefined}
                >
                  {turn.content}
                </AppText>
                {turn.articleSlugs.length > 0 ? (
                  <AppText variant="caption" tone="muted" style={{ marginTop: 6 }}>
                    {t('help.related', { slugs: turn.articleSlugs.join(', ') })}
                  </AppText>
                ) : null}
              </View>
            </View>
          ))}

          {sending ? (
            <View style={styles.rowAssistant}>
              <View style={[styles.bubbleAssistant, styles.typing]}>
                <ActivityIndicator size="small" color={colors.primaryDark} />
                <AppText variant="caption" tone="muted">
                  {t('help.checking')}
                </AppText>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('help.placeholder')}
            placeholderTextColor={colors.subtle}
            style={styles.input}
            accessibilityLabel="Message support"
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
              (sending || draft.trim().length < 2) && { opacity: 0.45 },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons name="arrow-up" size={19} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  feed: { padding: 16, gap: 12, paddingBottom: 24 },
  intro: { gap: 12 },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestion: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: { fontSize: 12.5, color: colors.text },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 },
  rowUser: { alignItems: 'flex-end' },
  rowAssistant: { alignItems: 'flex-start' },
  bubbleUser: {
    maxWidth: '86%',
    backgroundColor: colors.primary,
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleAssistant: {
    maxWidth: '92%',
    backgroundColor: colors.card,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14.5,
    color: colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
