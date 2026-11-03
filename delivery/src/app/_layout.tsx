import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { startRiderTracking, stopRiderTracking } from '@/lib/location';
import { registerRiderPush } from '@/lib/push';
import { setSessionExpiredHandler } from '@/lib/session';
import { ToastHost } from '@/components/ui/ToastHost';
import { useDeliveryStore } from '@/store/delivery';
import { useResolvedScheme, useThemeHydrated } from '@/store/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

setSessionExpiredHandler(() => {
  useDeliveryStore.getState().sessionExpired();
});

export default function DeliveryLayout() {
  const status = useDeliveryStore((state) => state.status);
  useThemeHydrated();
  const scheme = useResolvedScheme();

  useEffect(() => {
    return () => setSessionExpiredHandler(null);
  }, []);

  useEffect(() => {
    if (status !== 'signedIn') {
      void stopRiderTracking();
      return;
    }
    void startRiderTracking();
    void registerRiderPush().catch(() => undefined);
  }, [status]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack key={scheme} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="order/[id]" options={{ presentation: 'card' }} />
      </Stack>
      <ToastHost />
    </>
  );
}
