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

type SlotDay = {
  date: string;
  label: string;
  windows: {
    id: string;
    windowLabel: string;
    available: number;
    capacity: number;
  }[];
};

type WalletInfo = { balance: number };

type LoyaltyInfo = {
  points: number;
  pointValue: number;
  maxRedeemPct: number;
};

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

  const [fulfilment, setFulfilment] = useState<'delivery' | 'pickup'>('delivery');
  const [slotDays, setSlotDays] = useState<SlotDay[]>([]);
  const [slotDayIndex, setSlotDayIndex] = useState(0);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyInfo | null>(null);
  const [walletApply, setWalletApply] = useState(false);
  const [loyaltyApply, setLoyaltyApply] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('cod');
  const [upiUtr, setUpiUtr] = useState('');

  const isPickup = fulfilment === 'pickup';
  const subtotal = cartSubtotal(items);
  const baseFee = isPickup ? 0 : cartDeliveryFee(subtotal, store);
  const surge =
    !isPickup && store?.weatherMode && store.weatherMode !== 'NORMAL'
      ? Number(store.surgeFee ?? 0)
      : 0;
  const deliveryFee = baseFee + surge;
  const maxLoyalty = subtotal * ((loyalty?.maxRedeemPct ?? 20) / 100);
  const loyaltyAmount =
    loyaltyApply && loyalty
      ? Math.min(loyalty.points * loyalty.pointValue, maxLoyalty)
      : 0;
  const due = subtotal + deliveryFee - loyaltyAmount;
  const walletAmount =
    walletApply && wallet ? Math.min(wallet.balance, Math.max(0, due)) : 0;
  const total = Math.max(0, due - walletAmount);
  const currentDay = slotDays[slotDayIndex];
  const availableWindows = currentDay?.windows.filter((window) => window.available > 0) ?? [];

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

  const loadCheckoutExtras = useCallback(async () => {
    const [walletResult, loyaltyResult, slotResult] = await Promise.allSettled([
      apiRequest<WalletInfo>('/money/wallet'),
      apiRequest<LoyaltyInfo>('/money/loyalty'),
      apiRequest<SlotDay[]>('/slots?days=2'),
    ]);
    if (walletResult.status === 'fulfilled') setWallet(walletResult.value);
    if (loyaltyResult.status === 'fulfilled') setLoyalty(loyaltyResult.value);
    if (slotResult.status === 'fulfilled') {
      setSlotDays(slotResult.value);
      setSlotDayIndex(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAddresses();
      void loadCheckoutExtras();
    }, [loadAddresses, loadCheckoutExtras]),
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
      setOrderError('NeuraCart is closed right now. Please order during opening hours.');
      return;
    }
    if (!isPickup && availableWindows.length > 0 && !selectedSlotId) {
      setOrderError('Choose a delivery slot before placing your order.');
      return;
    }
    if (paymentMethod === 'online' && !/^\d{4}$/.test(upiUtr.trim())) {
      setOrderError('Enter the last 4 digits of your UPI reference.');
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
          paymentMethod,
          fulfilment,
          ...(isPickup ? {} : { slotId: selectedSlotId ?? undefined }),
          walletApply,
          loyaltyApply,
          ...(paymentMethod === 'online' ? { upiUtrLast4: upiUtr.trim() } : {}),
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
        subtitle={`${items.length} ${items.length === 1 ? 'line item' : 'line items'} · ${isPickup ? 'store pickup' : paymentMethod === 'online' ? 'UPI' : 'cash on delivery'}`}
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
            <AppText variant="section">How would you like it?</AppText>
            <AppText variant="caption" tone="muted">
              Doorstep delivery or collect from the store.
            </AppText>
          </View>
        </View>
        <View style={styles.choiceRow}>
          {(['delivery', 'pickup'] as const).map((option) => {
            const active = fulfilment === option;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  setFulfilment(option);
                  if (option === 'pickup') setSelectedSlotId(null);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.choice, active && styles.choiceActive]}
              >
                <Ionicons
                  name={option === 'delivery' ? 'bicycle-outline' : 'storefront-outline'}
                  size={19}
                  color={active ? colors.primaryDark : colors.subtle}
                />
                <AppText
                  variant="meta"
                  tone={active ? 'primary' : 'muted'}
                  style={{ fontWeight: '700' }}
                >
                  {option === 'delivery' ? 'Delivery' : 'Store pickup'}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {!isPickup ? (
          <>
            <View style={styles.sectionHeading}>
              <View style={{ gap: 2 }}>
                <AppText variant="section">Delivery slot</AppText>
                <AppText variant="caption" tone="muted">
                  Two-hour windows, capped per slot.
                </AppText>
              </View>
            </View>
            {slotDays.length === 0 ? (
              <Card style={styles.addressLoading}>
                <ActivityIndicator color={colors.primary} />
                <AppText variant="meta" tone="muted">
                  Loading slots…
                </AppText>
              </Card>
            ) : (
              <View style={{ gap: 10 }}>
                <View style={styles.dayRow}>
                  {slotDays.map((day, index) => (
                    <Pressable
                      key={day.date}
                      onPress={() => {
                        setSlotDayIndex(index);
                        setSelectedSlotId(null);
                      }}
                      style={[styles.dayChip, index === slotDayIndex && styles.dayChipActive]}
                    >
                      <AppText
                        variant="caption"
                        tone={index === slotDayIndex ? 'primary' : 'muted'}
                        style={{ fontWeight: '700' }}
                      >
                        {day.label}
                      </AppText>
                      <AppText variant="caption" tone="subtle">
                        {day.date.slice(5)}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.slotGrid}>
                  {availableWindows.length === 0 ? (
                    <AppText variant="caption" tone="muted">
                      No slots left for this day — try the next one.
                    </AppText>
                  ) : (
                    availableWindows.map((window) => {
                      const active = selectedSlotId === window.id;
                      return (
                        <Pressable
                          key={window.id}
                          onPress={() => setSelectedSlotId(window.id)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          style={[styles.slotChip, active && styles.slotChipActive]}
                        >
                          <AppText
                            variant="caption"
                            tone={active ? 'primary' : 'muted'}
                            style={{ fontWeight: '700' }}
                          >
                            {window.windowLabel}
                          </AppText>
                          <AppText variant="caption" tone="subtle">
                            {window.available} left
                          </AppText>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </View>
            )}
          </>
        ) : null}

        <View style={styles.sectionHeading}>
          <View style={{ gap: 2 }}>
            <AppText variant="section">Payment method</AppText>
            <AppText variant="caption" tone="muted">
              UPI pays instantly; cash is collected on arrival.
            </AppText>
          </View>
        </View>

        <View style={styles.paymentList}>
          <Pressable
            onPress={() => setPaymentMethod('cod')}
            accessibilityRole="radio"
            accessibilityState={{ selected: paymentMethod === 'cod' }}
            style={[styles.paymentOption, paymentMethod === 'cod' && styles.paymentSelected]}
          >
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
            <View style={[styles.radio, paymentMethod === 'cod' && styles.radioSelected]}>
              {paymentMethod === 'cod' ? <View style={styles.radioInner} /> : null}
            </View>
          </Pressable>

          <Pressable
            onPress={() => setPaymentMethod('online')}
            accessibilityRole="radio"
            accessibilityState={{ selected: paymentMethod === 'online' }}
            style={[styles.paymentOption, paymentMethod === 'online' && styles.paymentSelected]}
          >
            <View style={styles.paymentIcon}>
              <Ionicons name="phone-portrait-outline" size={22} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
                UPI
              </AppText>
              <AppText variant="caption" tone="muted">
                Pay with GPay, PhonePe or any UPI app.
              </AppText>
            </View>
            <View style={[styles.radio, paymentMethod === 'online' && styles.radioSelected]}>
              {paymentMethod === 'online' ? <View style={styles.radioInner} /> : null}
            </View>
          </Pressable>

          {paymentMethod === 'online' ? (
            <TextField
              label="UPI reference — last 4 digits"
              placeholder="e.g. 4821"
              value={upiUtr}
              onChangeText={(value) => setUpiUtr(value.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              editable={!placing}
              hint="Shown in your UPI app after paying. The store verifies it before dispatch."
            />
          ) : null}
        </View>

        {wallet || loyalty ? (
          <>
            <View style={styles.sectionHeading}>
              <AppText variant="section">Save more</AppText>
            </View>
            <View style={styles.paymentList}>
              {wallet ? (
                <Pressable
                  onPress={() => setWalletApply((value) => !value)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: walletApply }}
                  style={[styles.paymentOption, walletApply && styles.paymentSelected]}
                >
                  <View style={styles.paymentIcon}>
                    <Ionicons name="wallet-outline" size={22} color={colors.primaryDark} />
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
                      Use wallet balance
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {money(wallet.balance)} available
                    </AppText>
                  </View>
                  <View style={[styles.checkbox, walletApply && styles.checkboxActive]}>
                    {walletApply ? (
                      <Ionicons name="checkmark" size={14} color={colors.white} />
                    ) : null}
                  </View>
                </Pressable>
              ) : null}
              {loyalty && loyalty.points > 0 ? (
                <Pressable
                  onPress={() => setLoyaltyApply((value) => !value)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: loyaltyApply }}
                  style={[styles.paymentOption, loyaltyApply && styles.paymentSelected]}
                >
                  <View style={styles.paymentIcon}>
                    <Ionicons name="star-outline" size={22} color={colors.primaryDark} />
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
                      Redeem loyalty points
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {loyalty.points} pts · up to {loyalty.maxRedeemPct}% of items
                    </AppText>
                  </View>
                  <View style={[styles.checkbox, loyaltyApply && styles.checkboxActive]}>
                    {loyaltyApply ? (
                      <Ionicons name="checkmark" size={14} color={colors.white} />
                    ) : null}
                  </View>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}

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

        {!isPickup ? (
          <FreeDeliveryProgress
            subtotal={subtotal}
            threshold={Number(store.freeDeliveryAbove)}
            fee={deliveryFee}
          />
        ) : null}

        <Card style={styles.billCard}>
          <AppText variant="section">Bill details</AppText>
          <BillSummary
            order={{
              subtotal: subtotal.toFixed(2),
              deliveryFee: deliveryFee.toFixed(2),
              discount: (loyaltyAmount + walletAmount).toFixed(2),
              total: total.toFixed(2),
            }}
          />
          {surge > 0 ? (
            <AppText variant="caption" tone="muted">
              Includes a {money(surge)} weather surge fee.
            </AppText>
          ) : null}
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
  choiceRow: { flexDirection: 'row', gap: 10 },
  choice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  choiceActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  dayRow: { flexDirection: 'row', gap: 8 },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  dayChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: {
    minWidth: '46%',
    gap: 1,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  slotChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
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
  paymentIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
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
