import { colors, radius, shadows, themedStyles } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/AppText';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { apiErrorMessage } from '@/lib/api';
import { fetchGoogleStatus, startGoogleSignIn } from '@/lib/oauth';
import { useAuthStore } from '@/store/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sendOtp = useAuthStore((state) => state.sendOtp);
  const completeOAuth = useAuthStore((state) => state.completeOAuth);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    void fetchGoogleStatus()
      .then((status) => setGoogleConfigured(status.configured))
      .catch(() => setGoogleConfigured(false));
  }, []);

  async function signInWithGoogle() {
    if (googleLoading) return;
    setError(null);
    setGoogleLoading(true);
    try {
      const tokens = await startGoogleSignIn();
      if (!tokens) return;
      await completeOAuth(tokens.accessToken, tokens.refreshToken);
      router.replace('/(tabs)');
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function submit() {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      setError('Enter a valid email address');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await sendOtp(normalized);
      router.push({
        pathname: '/(auth)/otp',
        params: { email: normalized, devOtp: result.devOtp ?? '' },
      });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#14532D', '#15803D', '#22C55E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 22 }]}
        >
          <View style={styles.heroBubble} />
          <BrandMark size={52} light showWordmark />
          <View style={styles.heroCopy}>
            <AppText variant="title" tone="white" style={styles.heroTitle}>
              Fresh groceries,{'\n'}right around the corner.
            </AppText>
            <AppText variant="body" style={styles.heroSubtitle}>
              Handpicked produce from your neighbourhood store, delivered in minutes.
            </AppText>
          </View>
        </LinearGradient>

        <View style={styles.sheet}>
          <View style={styles.heading}>
            <AppText variant="title">Welcome to NeuraCart</AppText>
            <AppText variant="body" tone="muted">
              Sign in or create your account with an email address.
            </AppText>
          </View>

          <View style={styles.form}>
            <TextField
              label="Email address"
              required
              icon="mail-outline"
              placeholder="you@example.com"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (error) setError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={submit}
              error={error}
              editable={!loading}
            />

            <Button
              label="Send OTP"
              onPress={submit}
              loading={loading}
              iconRight="arrow-forward"
              accessibilityLabel="Send one-time code"
            />

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <AppText variant="caption" tone="subtle">
                or
              </AppText>
              <View style={styles.divider} />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
              accessibilityState={{ disabled: googleLoading || googleConfigured === false }}
              disabled={googleLoading || googleConfigured === false}
              onPress={() => void signInWithGoogle()}
              style={({ pressed }) => [
                styles.googleButton,
                pressed && { opacity: 0.85 },
                googleConfigured === false && { opacity: 0.5 },
              ]}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Ionicons name="logo-google" size={18} color={colors.text} />
              )}
              <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
                Continue with Google
              </AppText>
            </Pressable>
            {googleConfigured === false ? (
              <AppText variant="caption" tone="subtle" style={{ textAlign: 'center' }}>
                Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the API .env to enable this.
              </AppText>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fill demo customer email"
            onPress={() => {
              setEmail('customer@neuracart.app');
              setError(null);
            }}
            style={({ pressed }) => [styles.demo, pressed && { opacity: 0.75 }]}
          >
            <View style={styles.demoIcon}>
              <Ionicons name="flask-outline" size={19} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <AppText variant="meta" style={{ fontWeight: '700' }}>
                Demo customer account
              </AppText>
              <AppText variant="caption" tone="muted">
                Tap to use customer@neuracart.app
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.subtle} />
          </Pressable>

          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.muted} />
            <AppText variant="caption" tone="muted" style={styles.infoText}>
              We’ll email you a 6-digit code. No passwords, no fuss.
            </AppText>
          </View>

          <AppText variant="caption" tone="subtle" style={styles.terms}>
            By continuing, you agree to NeuraCart’s Terms of Service and Privacy Policy.
          </AppText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = themedStyles((colors) => StyleSheet.create({
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  fill: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingBottom: 28 },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 54,
    gap: 28,
    overflow: 'hidden',
  },
  heroBubble: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(255,255,255,0.06)',
    right: -80,
    top: -50,
  },
  heroCopy: { gap: 9 },
  heroTitle: { fontSize: 27, lineHeight: 34, letterSpacing: -0.5 },
  heroSubtitle: { color: 'rgba(255,255,255,0.8)', maxWidth: 320 },
  sheet: {
    marginTop: -28,
    marginHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: radius.xxl,
    padding: 22,
    gap: 22,
    ...shadows.card,
  },
  heading: { gap: 7 },
  form: { gap: 16 },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    padding: 12,
  },
  demoIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingHorizontal: 2 },
  infoText: { flex: 1 },
  terms: { textAlign: 'center', lineHeight: 16 },
}));

