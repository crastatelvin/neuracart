import '../global.css';

import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '@/components/ui/ToastHost';
import { colors } from '@/constants/design';
import { registerForPush } from '@/lib/push';
import { setSessionExpiredHandler } from '@/lib/session';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import { useConfigStore } from '@/store/config';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const loadStore = useConfigStore((state) => state.loadStore);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  useEffect(() => {
    if (user) {
      void useCartStore.getState().hydrate(user.id);
      void registerForPush().catch(() => undefined);
    } else {
      useCartStore.getState().reset();
    }
  }, [user]);

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
      <StatusBar style="dark" />
      <Stack
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
