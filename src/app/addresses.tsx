import { colors, radius, themedStyles } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { AddressCard } from '@/components/AddressCard';
import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/Badge';
import { ScreenHeader } from '@/components/ui/Header';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { apiErrorMessage, apiRequest } from '@/lib/api';
import { MAX_ADDRESSES } from '@/lib/config';
import type { Address } from '@/lib/types';
import { useToastStore } from '@/store/toast';

export default function AddressesScreen() {
  const router = useRouter();
  const showToast = useToastStore((state) => state.show);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<Address[]>('/addresses');
      setAddresses(result);
    } catch (caught) {
      if (!quiet) setError(apiErrorMessage(caught));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }

  function deleteAddress(address: Address) {
    Alert.alert(
      'Delete this address?',
      address.isDefault
        ? 'This is your default address. The next saved address will become the default.'
        : 'You can always add it again later.',
      [
        { text: 'Keep address', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusyId(address.id);
            try {
              await apiRequest(`/addresses/${address.id}`, { method: 'DELETE' });
              await load(true);
              showToast('Address deleted', 'info');
            } catch (caught) {
              showToast(apiErrorMessage(caught), 'error');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }

  async function makeDefault(address: Address) {
    setBusyId(address.id);
    try {
      await apiRequest(`/addresses/${address.id}/default`, { method: 'PATCH' });
      await load(true);
      showToast('Default address updated');
    } catch (caught) {
      showToast(apiErrorMessage(caught), 'error');
    } finally {
      setBusyId(null);
    }
  }

  const full = addresses.length >= MAX_ADDRESSES;

  return (
    <View style={styles.fill}>
      <StatusBar style="auto" />
      <ScreenHeader
        title="Saved addresses"
        subtitle={
          addresses.length
            ? `${addresses.length} of ${MAX_ADDRESSES} saved`
            : 'Your delivery spots will live here'
        }
        onBack={() => router.back()}
        right={
          <IconButton
            icon="add"
            onPress={() => {
              if (full) {
                showToast(`You can save up to ${MAX_ADDRESSES} addresses`, 'error');
                return;
              }
              router.push('/add-address');
            }}
            accessibilityLabel="Add address"
            size={38}
            color={colors.primaryDark}
            backgroundColor={colors.primarySoft}
            border={false}
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        {full ? (
          <View style={styles.limitNote}>
            <Ionicons name="information-circle-outline" size={17} color={colors.muted} />
            <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
              You’ve saved the maximum of {MAX_ADDRESSES} addresses. Delete one to add another.
            </AppText>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="meta" tone="muted">
              Loading your addresses…
            </AppText>
          </View>
        ) : error ? (
          <ErrorState description={error} onRetry={() => load()} />
        ) : addresses.length === 0 ? (
          <EmptyState
            icon="location-outline"
            title="No saved addresses"
            description="Add your home, work, or any other delivery spot to make checkout quicker."
            actionLabel="Add address"
            onAction={() => router.push('/add-address')}
          />
        ) : (
          <View style={styles.list}>
            {addresses.map((address) => (
              <View key={address.id} style={busyId === address.id && { opacity: 0.6 }}>
                <AddressCard
                  address={address}
                  showActions
                  onEdit={() =>
                    router.push({
                      pathname: '/edit-address/[id]',
                      params: { id: address.id },
                    })
                  }
                  onDelete={() => deleteAddress(address)}
                  onSetDefault={
                    address.isDefault ? undefined : () => void makeDefault(address)
                  }
                />
              </View>
            ))}
          </View>
        )}

        {!loading && !error && addresses.length > 0 ? (
          <Pressable
            onPress={() => {
              if (full) {
                showToast(`You can save up to ${MAX_ADDRESSES} addresses`, 'error');
                return;
              }
              router.push('/add-address');
            }}
            accessibilityRole="button"
            accessibilityLabel="Add another address"
            style={({ pressed }) => [styles.addAnother, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.primaryDark} />
            <AppText variant="meta" tone="primary" style={{ fontWeight: '700' }}>
              Add another address
            </AppText>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = themedStyles((colors) => StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 14, flexGrow: 1 },
  center: { flex: 1, paddingVertical: 60, alignItems: 'center', justifyContent: 'center', gap: 12 },
  list: { gap: 11 },
  limitNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addAnother: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
}));
