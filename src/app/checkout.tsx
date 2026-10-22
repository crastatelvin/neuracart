import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { AddressCard } from '@/components/AddressCard';
import { BillSummary, FreeDeliveryProgress } from '@/components/OrderBits';
import { AppText } from '@/components/ui/AppText';
import { BottomBar } from '@/components/ui/BottomBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/Header';
import { ErrorState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { colors, radius } from '@/constants/design';
import { apiErrorMessage, apiRequest, isApiError } from '@/lib/api';
import { MAX_ADDRESSES } from '@/lib/config';
import { money } from '@/lib/format';
import type { Address, Order } from '@/lib/types';
import { cartDeliveryFee, cartSubtotal, useCartStore } from '@/store/cart';
import { useConfigStore } from '@/store/config';
import { useToastStore } from '@/store/toast';

let sessionAddressId: string | null = null;

export default function CheckoutScreen() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const clear = useCartStore((state) => state.clear);
  const store = useConfigStore((state) => state.store);
  const showToast = useToastStore((state) => state.show);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [updatingDefault, setUpdatingDefault] = useState<string | null>(null);
  const idempotencyKey = useRef(Crypto.randomUUID());

  const subtotal = cartSubtotal(items);
  const deliveryFee = cartDeliveryFee(subtotal, store);
  const total = subtotal + deliveryFee;

  const loadAddresses = useCallback(async () => {
    setAddressError(null);
    try {
      const result = await apiRequest<Address[]>('/addresses');
      setAddresses(result);
      setSelectedAddressId((current) => {
        const wanted = current ?? sessionAddressId;
        if (wanted && result.some((address) => address.id === wanted)) {
          sessionAddressId = wanted;
          return wanted;
        }
        const preferred = (result.find((address) => address.isDefault) ?? result[0])?.id ?? null;
        sessionAddressId = preferred;
        return preferred;
      });
    } catch (caught) {
      setAddressError(apiErrorMessage(caught));
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAddresses();
    }, [loadAddresses]),
  );

  async function setDefault(address: Address) {
    setUpdatingDefault(address.id);
    try {
      await apiRequest(`/addresses/${address.id}/default`, { method: 'PATCH' });
      setAddresses((current) =>
        current.map((item) => ({ ...item, isDefault: item.id === address.id })),
      );
    } catch (caught) {
      showToast(apiErrorMessage(caught), 'error');
    } finally {
      setUpdatingDefault(null);
    }
  }

  async function placeOrder() {
    if (placing) return;
    if (items.length === 0) {
      setOrderError('Your cart is empty. Add something fresh before checking out.');
      return;
    }
    if (!selectedAddressId) {
      setOrderError('Choose a delivery address before placing your order.');
      return;
    }
    if (!store.isOpen) {
      setOrderError('LocalMart is closed right now. Please order during opening hours.');
      return;
    }
    setPlacing(true);
    setOrderError(null);
    try {
      const order = await apiRequest<Order>('/orders', {
        method: 'POST',
        idempotencyKey: idempotencyKey.current,
        body: {
          addressId: selectedAddressId,
          paymentMethod: 'cod',
          items: items.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      });
      clear();
      showToast(`Order #${order.orderNumber} placed successfully`);
      router.replace({
        pathname: '/order/[id]',
        params: { id: order.id },
      });
    } catch (caught) {
      const message = apiErrorMessage(caught);
      if (isApiError(caught) && caught.code === 'PRICE_CHANGED') {
        setOrderError(`${message} Please review your cart before trying again.`);
      } else {
        setOrderError(message);
      }
    } finally {
      setPlacing(false);
    }
  }

  if (items.length === 0) {
    return (
      <View style={styles.fill}>
        <StatusBar style="dark" />
        <ScreenHeader title="Checkout" onBack={() => router.back()} />
        <ErrorState
          title="Your cart is empty"
          description="Add a few fresh favourites before heading to checkout."
          onRetry={() => router.replace('/(tabs)')}
        />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Checkout"
        subtitle={`${items.length} ${items.length === 1 ? 'line item' : 'line items'} · cash on delivery`}
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.sectionHeading}>
          <View style={{ gap: 2 }}>
            <AppText variant="section">Delivery address</AppText>
            <AppText variant="caption" tone="muted">
              Where should we bring your order?
            </AppText>
          </View>
          {addresses.length < MAX_ADDRESSES ? (
            <Pressable
              onPress={() => router.push('/add-address')}
              accessibilityRole="button"
              accessibilityLabel="Add a new delivery address"
              style={({ pressed }) => [styles.addLink, pressed && { opacity: 0.65 }]}
            >
              <Ionicons name="add" size={16} color={colors.primaryDark} />
              <AppText variant="meta" tone="primary" style={{ fontWeight: '700' }}>
                Add new
              </AppText>
            </Pressable>
          ) : null}
        </View>

        {loadingAddresses ? (
          <Card style={styles.addressLoading}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="meta" tone="muted">
              Loading your addresses…
            </AppText>
          </Card>
        ) : addressError ? (
          <Card style={styles.inlineError}>
            <Ionicons name="cloud-offline-outline" size={19} color={colors.danger} />
            <AppText variant="meta" tone="danger" style={{ flex: 1 }}>
              {addressError}
            </AppText>
            <Pressable onPress={loadAddresses} hitSlop={6}>
              <AppText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
                Retry
              </AppText>
            </Pressable>
          </Card>
        ) : addresses.length === 0 ? (
          <Pressable
            onPress={() => router.push('/add-address')}
            style={({ pressed }) => [styles.emptyAddress, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.emptyAddressIcon}>
              <Ionicons name="location-outline" size={23} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
                Add a delivery address
              </AppText>
              <AppText variant="caption" tone="muted">
                We deliver across serviceable Bengaluru pincodes.
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
          </Pressable>
        ) : (
          <View style={styles.addressList}>
            {addresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                selected={selectedAddressId === address.id}
                onSelect={() => {
                  sessionAddressId = address.id;
                  setSelectedAddressId(address.id);
                }}
                onEdit={() =>
                  router.push({
                    pathname: '/edit-address/[id]',
                    params: { id: address.id },
                  })
                }
                onSetDefault={
                  address.isDefault ? undefined : () => void setDefault(address)
                }
                showActions
              />
            ))}
            {updatingDefault ? (
              <AppText variant="caption" tone="muted">
                Updating default address…
              </AppText>
            ) : null}
          </View>
        )}

        <View style={styles.sectionHeading}>
          <View style={{ gap: 2 }}>
            <AppText variant="section">Payment method</AppText>
            <AppText variant="caption" tone="muted">
              Pay when your order arrives.
            </AppText>
          </View>
        </View>

        <View style={styles.paymentList}>
          <View style={[styles.paymentOption, styles.paymentSelected]}>
            <View style={styles.paymentIcon}>
              <Ionicons name="cash-outline" size={22} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
                Cash on delivery
              </AppText>
              <AppText variant="caption" tone="muted">
                Have the exact amount ready if possible.
              </AppText>
            </View>
            <View style={styles.radioSelected}>
              <View style={styles.radioInner} />
            </View>
          </View>

          <View style={[styles.paymentOption, styles.paymentDisabled]}>
            <View style={[styles.paymentIcon, { backgroundColor: colors.border }]}>
              <Ionicons name="card-outline" size={22} color={colors.subtle} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <AppText variant="bodyMedium" tone="subtle" style={{ fontWeight: '700' }}>
                Online payment
              </AppText>
              <AppText variant="caption" tone="subtle">
                UPI and cards are coming soon.
              </AppText>
            </View>
            <View style={styles.comingSoon}>
              <AppText variant="caption" tone="muted" style={{ fontWeight: '700' }}>
                Soon
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <AppText variant="section">Order summary</AppText>
          <AppText variant="caption" tone="muted">
            {items.length} {items.length === 1 ? 'product' : 'products'}
          </AppText>
        </View>

        <Card style={styles.summaryCard}>
          {items.map((item, index) => (
            <View
              key={item.product.id}
              style={[styles.summaryRow, index < items.length - 1 && styles.summaryBorder]}
            >
              <View style={styles.summaryQty}>
                <AppText variant="caption" tone="primary" style={{ fontWeight: '800' }}>
                  {item.quantity}×
                </AppText>
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <AppText variant="bodyMedium" numberOfLines={1}>
                  {item.product.name}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {item.product.unit}
                </AppText>
              </View>
              <AppText variant="bodyMedium">
                {money(Number(item.product.price) * item.quantity)}
              </AppText>
            </View>
          ))}
          <View style={styles.summaryTotal}>
            <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
              Item subtotal
            </AppText>
            <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
              {money(subtotal)}
            </AppText>
          </View>
        </Card>

        <FreeDeliveryProgress
          subtotal={subtotal}
          threshold={Number(store.freeDeliveryAbove)}
          fee={deliveryFee}
        />

        <Card style={styles.billCard}>
          <AppText variant="section">Bill details</AppText>
          <BillSummary
            order={{
              subtotal: subtotal.toFixed(2),
              deliveryFee: deliveryFee.toFixed(2),
              discount: '0',
              total: total.toFixed(2),
            }}
          />
        </Card>

        <View style={styles.notesBlock}>
          <TextField
            label="Delivery notes (optional)"
            placeholder="Gate code, landmark, or a note for the rider…"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
            editable={!placing}
            hint={`${notes.length}/500`}
          />
        </View>

        {orderError ? (
          <View style={styles.orderError}>
            <Ionicons name="alert-circle" size={19} color={colors.danger} />
            <AppText variant="meta" tone="danger" style={{ flex: 1 }}>
              {orderError}
            </AppText>
          </View>
        ) : null}

        <View style={styles.deliveryNote}>
          <Ionicons name="shield-checkmark-outline" size={17} color={colors.primaryDark} />
          <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
            Your address and contact details are only shared with the store and your delivery
            partner for this order.
          </AppText>
        </View>
      </ScrollView>

      <BottomBar>
        <View style={styles.payRow}>
          <View style={{ gap: 0 }}>
            <AppText variant="caption" tone="muted">
              Total payable
            </AppText>
            <AppText variant="price" style={{ fontSize: 21 }}>
              {money(total)}
            </AppText>
          </View>
          <Button
            label={placing ? 'Placing order…' : 'Place order'}
            onPress={placeOrder}
            loading={placing}
            disabled={!selectedAddressId || !store.isOpen}
            icon="lock-closed-outline"
            style={styles.placeButton}
          />
        </View>
        {!store.isOpen ? (
          <AppText variant="caption" tone="danger" style={styles.closedNote}>
            Store is closed right now — ordering will reopen during store hours.
          </AppText>
        ) : null}
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16, paddingBottom: 30 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 2,
  },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  addressList: { gap: 10 },
  addressLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderColor: '#FECACA',
  },
  emptyAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.primaryMuted,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: 15,
  },
  emptyAddressIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentList: { gap: 10 },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  paymentSelected: { borderColor: colors.primary },
  paymentDisabled: { opacity: 0.7, backgroundColor: '#FCFCFD' },
  paymentIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  comingSoon: {
    backgroundColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  summaryCard: { gap: 0 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 },
  summaryBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryQty: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    paddingTop: 11,
    marginTop: 6,
  },
  billCard: { gap: 13 },
  notesBlock: { marginTop: 2 },
  orderError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    padding: 12,
  },
  deliveryNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingHorizontal: 2 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  placeButton: { flex: 1 },
  closedNote: { textAlign: 'center', marginTop: 5 },
});
