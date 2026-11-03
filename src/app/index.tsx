import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/AppText';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { colors, radius } from '@/constants/design';
import { useAuthStore } from '@/store/auth';

export default function AuthGateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const bootError = useAuthStore((state) => state.bootError);
  const loadStoredAuth = useAuthStore((state) => state.loadStoredAuth);
  const clearLocalSession = useAuthStore((state) => state.clearLocalSession);
  const [minimumElapsed, setMinimumElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinimumElapsed(true), 500);
    return () => clearTimeout(timer);
  }, [loadStoredAuth]);

  useEffect(() => {
    if (isLoading || !minimumElapsed) return;
    void SplashScreen.hideAsync().catch(() => undefined);
    if (bootError) return;
    router.replace(isAuthenticated ? '/(tabs)' : '/(auth)');
  }, [bootError, isAuthenticated, isLoading, minimumElapsed, router]);

  async function retry() {
    await loadStoredAuth();
  }

  async function signInInstead() {
    await clearLocalSession();
    router.replace('/(auth)');
  }

  return (
    <LinearGradient
      colors={['#14532D', '#15803D', '#22C55E']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.fill}
    >
      <StatusBar style="light" />
      <View style={styles.bubbleOne} />
      <View style={styles.bubbleTwo} />
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 28 },
        ]}
      >
        <View style={styles.brand}>
          <BrandMark size={78} light />
          <AppText variant="display" tone="white" style={styles.wordmark}>
            LocalMart
          </AppText>
          <AppText variant="body" style={styles.tagline}>
            Your neighbourhood market, delivered.
          </AppText>
        </View>

        {bootError ? (
          <View style={styles.errorCard}>
            <AppText variant="section">We couldn’t reach your account</AppText>
            <AppText variant="body" tone="muted" style={styles.errorText}>
              {bootError}
            </AppText>
            <Button label="Try again" onPress={retry} icon="refresh" />
            <Button
              label="Sign in instead"
              onPress={signInInstead}
              variant="ghost"
              style={{ marginTop: 4 }}
            />
          </View>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.white} />
            <AppText variant="meta" style={{ color: 'rgba(255,255,255,0.78)' }}>
              Fresh finds, close to home
            </AppText>
          </View>
        )}

        <AppText variant="caption" style={styles.footer}>
          Bengaluru · 08:00–22:00 IST
        </AppText>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  bubbleOne: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -80,
    right: -90,
  },
  bubbleTwo: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: 80,
    left: -100,
  },
  brand: { alignItems: 'center', marginTop: 36 },
  wordmark: { marginTop: 18, letterSpacing: -1.2 },
  tagline: { color: 'rgba(255,255,255,0.82)', marginTop: 8, textAlign: 'center' },
  loading: { alignItems: 'center', gap: 12, marginBottom: 10 },
  errorCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.xxl,
    padding: 20,
    gap: 10,
    marginTop: 36,
  },
  errorText: { marginBottom: 6 },
  footer: { color: 'rgba(255,255,255,0.66)' },
});
