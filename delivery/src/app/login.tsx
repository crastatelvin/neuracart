import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { radius, themedStyles } from '@/constants/design';
import { DEMO_CREDENTIALS } from '@/lib/config';
import { apiErrorMessage, isApiError } from '@/lib/api';
import { useDeliveryStore } from '@/store/delivery';
import { useToastStore } from '@/store/toast';

const ERROR_COPY: Record<string, string> = {
  INVALID_CREDENTIALS: 'Invalid email or password.',
  RIDER_NOT_VERIFIED: 'Your account is not verified. Contact the store.',
  ACCOUNT_INACTIVE: 'Account deactivated. Contact the store.',
};

export default function LoginScreen() {
  const router = useRouter();
  const signIn = useDeliveryStore((state) => state.signIn);
  const toast = useToastStore((state) => state.show);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (submitting) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Enter your registered email address.');
      return;
    }
    if (password.length < 8) {
      setError('Passwords are at least 8 characters.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      toast('Signed in. Stay safe out there.');
      router.replace('/assignments');
    } catch (caught) {
      const code = isApiError(caught) ? caught.code : '';
      setError(ERROR_COPY[code] ?? apiErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={['#14532D', '#15803D', '#22C55E']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.fill}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <BrandMark size={56} light />
            <AppText variant="title" tone="white" style={styles.heroTitle}>
              NeuraCart Delivery
            </AppText>
            <AppText variant="bodyMedium" tone="white" style={styles.heroSub}>
              Delivery Partner Portal
            </AppText>
          </View>

          <View style={styles.card}>
            <AppText variant="section">Welcome back, rider</AppText>
            <AppText variant="body" tone="muted" style={styles.cardHint}>
              Sign in to receive assignments from the store.
            </AppText>

            <TextField
              label="Email"
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              placeholder="driver@neuracart.app"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setError(null);
              }}
              editable={!submitting}
            />
            <TextField
              label="Password"
              icon="lock-closed-outline"
              secureTextEntry={!showPassword}
              textContentType="password"
              placeholder="••••••••"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setError(null);
              }}
              editable={!submitting}
              error={error}
              rightAccessory={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  onPress={() => setShowPassword((value) => !value)}
                  hitSlop={8}
                >
                  <AppText variant="meta" tone="primary">
                    {showPassword ? 'Hide' : 'Show'}
                  </AppText>
                </Pressable>
              }
            />

            <Button
              label="Sign in"
              onPress={() => void submit()}
              loading={submitting}
              disabled={submitting}
            />

            <AppText variant="caption" tone="subtle" style={styles.reset}>
              Forgot password? Contact the store.
            </AppText>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fill demo rider credentials"
              onPress={() => {
                setEmail(DEMO_CREDENTIALS.email);
                setPassword(DEMO_CREDENTIALS.password);
                setError(null);
              }}
              style={styles.demo}
            >
              <AppText variant="caption" tone="muted">
                Demo: {DEMO_CREDENTIALS.email} · {DEMO_CREDENTIALS.password}
              </AppText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = themedStyles((colors) => StyleSheet.create({
  fill: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 36,
  },
  hero: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 40,
    paddingBottom: 28,
  },
  heroTitle: { marginTop: 6 },
  heroSub: { opacity: 0.85 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xxl,
    padding: 22,
    gap: 16,
  },
  cardHint: { marginTop: -8 },
  reset: { textAlign: 'center' },
  demo: { alignItems: 'center', paddingVertical: 2 },
}));
