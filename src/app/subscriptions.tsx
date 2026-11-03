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
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/Header';
import { apiErrorMessage, apiRequest } from '@/lib/api';
import { money } from '@/lib/format';
import type { Address } from '@/lib/types';
import { useCartStore } from '@/store/cart';
import { useToastStore } from '@/store/toast';

type SubscriptionItem = {
  productId: string;
  quantity: number;
  product: { id: string; name: string; unit: string; price: string; isActive: boolean } | null;
};

type Subscription = {
  id: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  cadenceDays: number;
  dayOfWeek: number;
  notes: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  address: { label: string; line1: string; city: string };
  items: SubscriptionItem[];
};

const CADENCES = [7, 14, 28];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SubscriptionsScreen() {
  const router = useRouter();
  const showToast = useToastStore((state) => state.show);
  const cartItems = useCartStore((state) => state.items);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [cadence, setCadence] = useState(14);
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [addressId, setAddressId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [subsResult, addressResult] = await Promise.allSettled([
      apiRequest<Subscription[]>('/subscriptions'),
      apiRequest<Address[]>('/addresses'),
    ]);
    if (subsResult.status === 'fulfilled') setSubscriptions(subsResult.value);
    if (addressResult.status === 'fulfilled') {
      setAddresses(addressResult.value);
      setAddressId(
        (current) =>
          current ??
          (addressResult.value.find((address) => address.isDefault) ?? addressResult.value[0])?.id ??
          null,
      );
    }
    if (subsResult.status === 'rejected') {
      showToast(apiErrorMessage(subsResult.reason), 'error');
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void load().finally(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function createFromCart() {
    if (!addressId) {
      showToast('Add a delivery address first', 'error');
      return;
    }
    if (cartItems.length === 0) {
      showToast('Your cart is empty', 'error');
      return;
    }
    setCreating(true);
    try {
      await apiRequest('/subscriptions', {
        method: 'POST',
        body: {
          addressId,
          cadenceDays: cadence,
          dayOfWeek,
          items: cartItems.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
        },
      });
      showToast(`Subscription created — repeats every ${cadence} days`);
      setFormOpen(false);
      await load();
    } catch (caught) {
      showToast(apiErrorMessage(caught), 'error');
    } finally {
      setCreating(false);
    }
  }

  async function updateStatus(sub: Subscription, status: 'ACTIVE' | 'PAUSED' | 'CANCELLED') {
    setBusy(sub.id);
    try {
      await apiRequest(`/subscriptions/${sub.id}`, { method: 'PATCH', body: { status } });
      showToast(status === 'ACTIVE' ? 'Subscription resumed' : `Subscription ${status.toLowerCase()}`);
      await load();
    } catch (caught) {
      showToast(apiErrorMessage(caught), 'error');
    } finally {
      setBusy(null);
    }
  }

  function confirmCancel(sub: Subscription) {
    Alert.alert('Cancel this subscription?', 'You can create a new one any time from your cart.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel subscription',
        style: 'destructive',
        onPress: () => void updateStatus(sub, 'CANCELLED'),
      },
    ]);
  }

  return (
    <View style={styles.fill}>
      <StatusBar style="auto" />
      <ScreenHeader
        title="Subscriptions"
        subtitle="Repeat your regular basket"
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {formOpen ? (
          <Card style={{ gap: 12 }}>
            <AppText variant="section">New subscription</AppText>
            <AppText variant="caption" tone="muted">
              {cartItems.length} item{cartItems.length === 1 ? '' : 's'} from your cart, billed at the
              price on the day it runs.
            </AppText>
            <View style={{ gap: 6 }}>
              <AppText variant="meta" style={{ fontWeight: '700' }}>
                Repeat every
              </AppText>
              <View style={styles.chipRow}>
                {CADENCES.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setCadence(value)}
                    style={[styles.chip, cadence === value && styles.chipActive]}
                  >
                    <AppText
                      variant="caption"
                      tone={cadence === value ? 'primary' : 'muted'}
                      style={{ fontWeight: '700' }}
                    >
                      {value} days
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <AppText variant="meta" style={{ fontWeight: '700' }}>
                Preferred day
              </AppText>
              <View style={styles.chipRow}>
                {DAYS.map((day, index) => (
                  <Pressable
                    key={day}
                    onPress={() => setDayOfWeek(index)}
                    style={[styles.chip, dayOfWeek === index && styles.chipActive]}
                  >
                    <AppText
                      variant="caption"
                      tone={dayOfWeek === index ? 'primary' : 'muted'}
                      style={{ fontWeight: '700' }}
                    >
                      {day}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <AppText variant="meta" style={{ fontWeight: '700' }}>
                Deliver to
              </AppText>
              {addresses.length === 0 ? (
                <AppText variant="caption" tone="danger">
                  Add a delivery address to continue.
                </AppText>
              ) : (
                addresses.map((address) => (
                  <Pressable
                    key={address.id}
                    onPress={() => setAddressId(address.id)}
                    style={[styles.addressRow, addressId === address.id && styles.chipActive]}
                  >
                    <Ionicons
                      name={addressId === address.id ? 'radio-button-on' : 'radio-button-off'}
                      size={17}
                      color={addressId === address.id ? colors.primary : colors.subtle}
                    />
                    <View style={{ flex: 1 }}>
                      <AppText variant="caption" style={{ fontWeight: '700' }}>
                        {address.label}
                      </AppText>
                      <AppText variant="caption" tone="muted" numberOfLines={1}>
                        {address.line1}, {address.city}
                      </AppText>
                    </View>
                  </Pressable>
                ))
              )}
            </View>
            <View style={styles.formActions}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setFormOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                label={creating ? 'Creating…' : 'Create'}
                onPress={createFromCart}
                loading={creating}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ) : (
          <Button
            label={cartItems.length > 0 ? 'Subscribe to this cart' : 'Add items to your cart first'}
            icon="repeat-outline"
            onPress={() => (cartItems.length > 0 ? setFormOpen(true) : router.push('/(tabs)'))}
            disabled={cartItems.length === 0}
          />
        )}

        {loading ? (
          <Card style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </Card>
        ) : subscriptions.length === 0 ? (
          <Card style={styles.center}>
            <Ionicons name="repeat-outline" size={24} color={colors.primary} />
            <AppText variant="meta" tone="muted" style={{ textAlign: 'center' }}>
              No subscriptions yet. Fill your cart with essentials and subscribe to skip the
              weekly shop.
            </AppText>
          </Card>
        ) : (
          subscriptions.map((sub) => {
            const total = sub.items.reduce(
              (sum, item) => sum + Number(item.product?.price ?? 0) * item.quantity,
              0,
            );
            return (
              <Card key={sub.id} style={{ gap: 10 }}>
                <View style={styles.subHeader}>
                  <View style={{ gap: 2 }}>
                    <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
                      Every {sub.cadenceDays} days · {DAYS[sub.dayOfWeek]}
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {sub.address.label} · {sub.address.line1}
                    </AppText>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      sub.status === 'ACTIVE' && { backgroundColor: colors.primarySoft },
                      sub.status === 'PAUSED' && { backgroundColor: '#FEF3C7' },
                      sub.status === 'CANCELLED' && { backgroundColor: colors.dangerSoft },
                    ]}
                  >
                    <AppText
                      variant="caption"
                      tone={
                        sub.status === 'ACTIVE'
                          ? 'primary'
                          : sub.status === 'CANCELLED'
                            ? 'danger'
                            : 'muted'
                      }
                      style={{ fontWeight: '800' }}
                    >
                      {sub.status}
                    </AppText>
                  </View>
                </View>
                <View style={{ gap: 4 }}>
                  {sub.items.map((item) => (
                    <View key={item.productId} style={styles.itemRow}>
                      <AppText variant="caption" tone="muted" style={{ width: 26 }}>
                        {item.quantity}×
                      </AppText>
                      <AppText variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                        {item.product?.name ?? 'Unavailable product'}
                      </AppText>
                      <AppText variant="caption" tone="muted">
                        {money(Number(item.product?.price ?? 0) * item.quantity)}
                      </AppText>
                    </View>
                  ))}
                </View>
                <View style={styles.subFooter}>
                  <AppText variant="caption" tone="muted">
                    {sub.nextRunAt
                      ? `Next: ${new Date(sub.nextRunAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })} · ~${money(total)}`
                      : 'No upcoming run'}
                  </AppText>
                  {sub.status !== 'CANCELLED' ? (
                    <View style={styles.subActions}>
                      <Pressable
                        onPress={() =>
                          void updateStatus(sub, sub.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')
                        }
                        disabled={busy === sub.id}
                        hitSlop={6}
                      >
                        <AppText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
                          {sub.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                        </AppText>
                      </Pressable>
                      <Pressable onPress={() => confirmCancel(sub)} disabled={busy === sub.id} hitSlop={6}>
                        <AppText variant="caption" tone="danger" style={{ fontWeight: '700' }}>
                          Cancel
                        </AppText>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = themedStyles((colors) => StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 12, paddingBottom: 30 },
  center: { alignItems: 'center', gap: 9, paddingVertical: 24 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  formActions: { flexDirection: 'row', gap: 9 },
  subHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 9,
  },
  subActions: { flexDirection: 'row', gap: 14 },
}));
