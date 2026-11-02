import * as Location from 'expo-location';
import { apiRequest } from './api';

/**
 * Foreground-only rider tracking: while the app is open on an active delivery,
 * position is pushed every ~20s or 50m. The backend throttles to 15s.
 */
let subscription: Location.LocationSubscription | null = null;

export async function startRiderTracking(): Promise<void> {
  if (subscription) return;
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return;
    subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 20_000,
        distanceInterval: 50,
      },
      (position) => {
        void apiRequest('/delivery/location', {
          method: 'PATCH',
          body: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        }).catch(() => undefined);
      },
    );
  } catch {
    // Location is best-effort; never block a delivery.
  }
}

export async function stopRiderTracking(): Promise<void> {
  if (!subscription) return;
  subscription.remove();
  subscription = null;
}
