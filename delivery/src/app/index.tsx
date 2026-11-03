import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/design';
import { useDeliveryStore } from '@/store/delivery';

export default function AuthGateScreen() {
  const router = useRouter();
  const status = useDeliveryStore((state) => state.status);
  const loadStoredSession = useDeliveryStore((state) => state.loadStoredSession);
  const signOut = useDeliveryStore((state) => state.signOut);
  const [minimumElapsed, setMinimumElapsed] = useState(false);

  useEffect(() => {
    void loadStoredSession();
    const timer = setTimeout(() => setMinimumElapsed(true), 400);
    return () => clearTimeout(timer);
  }, [loadStoredSession]);

  useEffect(() => {
    if (status === 'booting' || !minimumElapsed) return;
    void SplashScreen.hideAsync().catch(() => undefined);
    router.replace(status === 'signedIn' ? '/assignments' : '/login');
  }, [minimumElapsed, router, status]);

  return (
    <LinearGradient
      colors={['#14532D', '#15803D', '#22C55E']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.fill}
    >
      <View style={styles.center}>
        <View style={styles.brand}>
          <BrandMark size={72} light />
          <View style={styles.wordmark}>
            <AppText variant="display" tone="white" style={styles.logo}>
              NeuraCart
            </AppText>
            <AppText variant="bodyMedium" tone="white" style={styles.tagline}>
              Delivery Partner Portal
            </AppText>
          </View>
        </View>
        {status === 'booting' ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Button
            label="Go to sign in"
            variant="light"
            onPress={() => void signInInstead()}
          />
        )}
      </View>
      <AppText variant="caption" tone="white" style={styles.footer}>
        NeuraCart · Your neighbourhood market, delivered
      </AppText>
    </LinearGradient>
  );

  async function signInInstead() {
    await signOut();
    router.replace('/login');
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    padding: 24,
  },
  brand: { alignItems: 'center', gap: 14 },
  wordmark: { alignItems: 'center' },
  logo: { letterSpacing: -1.2 },
  tagline: { opacity: 0.9 },
  footer: { textAlign: 'center', opacity: 0.75, paddingBottom: 18 },
});
