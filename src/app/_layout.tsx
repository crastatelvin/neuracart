import { colors } from '@/constants/design';
import '../global.css';

import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '@/components/ui/ToastHost';
import { apiRequest } from '@/lib/api';
import { parseOAuthTokens } from '@/lib/oauth';
import { registerForPush } from '@/lib/push';
import { setSessionExpiredHandler } from '@/lib/session';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import { useConfigStore } from '@/store/config';
import { applyServerLanguage, useLanguageStore } from '@/store/language';
import { useResolvedScheme, useThemeHydrated } from '@/store/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const loadStore = useConfigStore((state) => state.loadStore);
  const hydrateLanguage = useLanguageStore((state) => state.hydrate);
  const loadStoredAuth = useAuthStore((state) => state.loadStoredAuth);
  useThemeHydrated();
  const scheme = useResolvedScheme();

  useEffect(() => {
    void loadStore();
    void hydrateLanguage();
    void loadStoredAuth();
  }, [loadStore, hydrateLanguage, loadStoredAuth]);

  useEffect(() => {
    if (!user) return;
    void apiRequest<{ language?: string }>('/auth/me/prefs')
      .then((prefs) => applyServerLanguage(prefs.language))
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (user) {
      void useCartStore.getState().hydrate(user.id);
      void registerForPush().catch(() => undefined);
    } else {
      useCartStore.getState().reset();
    }
  }, [user]);

  // Consume the tokens Google sign-in appends to the redirect URL.
  useEffect(() => {
    const consume = (url: string | null) => {
      const tokens = parseOAuthTokens(url);
      if (!tokens) return;
      void useAuthStore
        .getState()
        .completeOAuth(tokens.accessToken, tokens.refreshToken)
        .then(() => router.replace('/(tabs)'))
        .catch(() => undefined);
    };

    if (Platform.OS === 'web') {
      consume(window.location.href);
      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      return;
    }

    void Linking.getInitialURL().then(consume);
    const subscription = Linking.addEventListener('url', (event) => consume(event.url));
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      void useAuthStore.getState().clearLocalSession();
      useCartStore.getState().reset();
      router.replace('/(auth)');
    });
    return () => setSessionExpiredHandler(null);
  }, [router]);

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        key={scheme}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="tracking/[id]" />
        <Stack.Screen name="addresses" />
        <Stack.Screen name="add-address" />
        <Stack.Screen name="edit-address/[id]" />
        <Stack.Screen name="edit-profile" />
      </Stack>
      <ToastHost />
    </SafeAreaProvider>
  );
}
