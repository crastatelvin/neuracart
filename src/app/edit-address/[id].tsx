import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AddressEditor } from '@/components/AddressEditor';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/Header';
import { colors } from '@/constants/design';
import { apiErrorMessage, apiRequest } from '@/lib/api';
import type { Address } from '@/lib/types';

export default function EditAddressScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const addressId = String(params.id ?? '');
  const [address, setAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<Address>(`/addresses/${addressId}`);
      setAddress(result);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [addressId]);

  useEffect(() => {
    if (!addressId) return;
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [addressId, load]);

  if (loading) {
    return (
      <View style={styles.fill}>
        <StatusBar style="dark" />
        <ScreenHeader title="Edit address" onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="meta" tone="muted">
            Loading your address…
          </AppText>
        </View>
      </View>
    );
  }

  if (error || !address) {
    return (
      <View style={styles.fill}>
        <StatusBar style="dark" />
        <ScreenHeader title="Edit address" onBack={() => router.back()} />
        <View style={styles.center}>
          <AppText variant="section">Address unavailable</AppText>
          <AppText variant="body" tone="muted" style={styles.errorText}>
            {error ?? 'This address could not be found.'}
          </AppText>
          <Button
            label="Try again"
            onPress={load}
            variant="secondary"
            icon="refresh"
            fullWidth={false}
          />
        </View>
      </View>
    );
  }

  return (
    <AddressEditor
      key={address.id}
      mode="edit"
      address={address}
      onBack={() => router.back()}
      onSubmit={async (values) => {
        await apiRequest<Address>(`/addresses/${address.id}`, {
          method: 'PUT',
          body: {
            label: values.label,
            line1: values.line1,
            line2: values.line2,
            city: values.city,
            state: values.state,
            pincode: values.pincode,
          },
        });
        router.back();
      }}
      onDelete={async () => {
        await apiRequest(`/addresses/${address.id}`, { method: 'DELETE' });
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorText: { textAlign: 'center', maxWidth: 300 },
});
