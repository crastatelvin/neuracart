import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { setSessionExpiredHandler } from '@/lib/session';
import { ToastHost } from '@/components/ui/ToastHost';
import { useDeliveryStore } from '@/store/delivery';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

setSessionExpiredHandler(() => {
  useDeliveryStore.getState().sessionExpired();
});

export default function DeliveryLayout() {
  useEffect(() => {
    return () => setSessionExpiredHandler(null);
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="order/[id]" options={{ presentation: 'card' }} />
      </Stack>
      <ToastHost />
    </>
  );
}
