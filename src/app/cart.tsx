import { colors, radius, themedStyles } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { BottomBar } from '@/components/ui/BottomBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/Header';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { EmptyState } from '@/components/ui/States';
import { FreeDeliveryProgress, BillSummary } from '@/components/OrderBits';
import { money } from '@/lib/format';
import {
  cartDeliveryFee,
  cartItemCount,
  cartSubtotal,
  useCartStore,
} from '@/store/cart';
import { useConfigStore } from '@/store/config';
import { useToastStore } from '@/store/toast';

export default function CartScreen() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const increment = useCartStore((state) => state.increment);
  const decrement = useCartStore((state) => state.decrement);
  const removeItem = useCartStore((state) => state.removeItem);
  const clear = useCartStore((state) => state.clear);
  const store = useConfigStore((state) => state.store);
  const showToast = useToastStore((state) => state.show);

  const count = cartItemCount(items);
  const subtotal = cartSubtotal(items);
  const deliveryFee = cartDeliveryFee(subtotal, store);
  const total = subtotal + deliveryFee;

  function confirmClear() {
    Alert.alert('Clear your cart?', 'All items will be removed from your cart.', [
      { text: 'Keep items', style: 'cancel' },
      {
        text: 'Clear cart',
        style: 'destructive',
        onPress: () => {
          clear();
          showToast('Cart cleared', 'info');
        },
      },
    ]);
  }

  if (items.length === 0) {
    return (
      <View style={styles.fill}>
        <StatusBar style="auto" />
        <ScreenHeader title="Your cart" onBack={() => router.back()} />
        <EmptyState
          icon="bag-handle-outline"
          title="Your cart is empty"
          description="Fill it with something fresh from your neighbourhood market."
          actionLabel="Start shopping"
          onAction={() => router.replace('/(tabs)')}
        />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <StatusBar style="auto" />
      <ScreenHeader
        title="Your cart"
        subtitle={`${count} ${count === 1 ? 'item' : 'items'} from ${store.name}`}
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={confirmClear}
            accessibilityRole="button"
            accessibilityLabel="Clear cart"
            hitSlop={8}
            style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.65 }]}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <AppText variant="caption" tone="danger" style={{ fontWeight: '700' }}>
              Clear
            </AppText>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!store.isOpen ? (
          <View style={styles.closedBanner}>
            <Ionicons name="moon-outline" size={18} color={colors.warning} />
            <AppText variant="meta" style={{ color: '#92400E', flex: 1 }}>
              The store is closed right now. You can still build your cart and come back during
              opening hours.
            </AppText>
          </View>
        ) : null}

        <Card padded={false} style={styles.itemsCard}>
          {items.map((item, index) => (
            <View
              key={item.product.id}
              style={[styles.item, index < items.length - 1 && styles.itemBorder]}
            >
              <Pressable
                onPress={() => router.push(`/product/${item.product.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`View ${item.product.name}`}
                style={styles.itemImageWrap}
              >
                {item.product.imageUrl ? (
                  <Image
                    source={{ uri: item.product.imageUrl }}
                    style={styles.itemImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Ionicons name="leaf-outline" size={26} color={colors.primary} />
                )}
              </Pressable>
              <View style={styles.itemInfo}>
                <View style={styles.itemTop}>
                  <Pressable
                    onPress={() => router.push(`/product/${item.product.id}`)}
                    style={{ flex: 1, gap: 2 }}
                  >
                    <AppText variant="card" numberOfLines={2}>
                      {item.product.name}
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {item.product.unit} · {money(item.product.price)} each
                    </AppText>
                  </Pressable>
                  <Pressable
                    onPress={() => removeItem(item.product.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.product.name}`}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={18} color={colors.subtle} />
                  </Pressable>
                </View>
                <View style={styles.itemBottom}>
                  <AppText variant="card" style={{ color: colors.primaryDark }}>
                    {money(Number(item.product.price) * item.quantity)}
                  </AppText>
                  <QuantityStepper
                    quantity={item.quantity}
                    onIncrement={() => increment(item.product.id)}
                    onDecrement={() => decrement(item.product.id)}
                    max={item.product.stock}
                    compact
                  />
                </View>
              </View>
            </View>
          ))}
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
          <View style={styles.savingsNote}>
            <Ionicons name="information-circle-outline" size={15} color={colors.muted} />
            <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
              Prices include GST. Final amounts are confirmed by the store at checkout.
            </AppText>
          </View>
        </Card>

        <View style={styles.deliveryNote}>
          <View style={styles.deliveryIcon}>
            <Ionicons name="bicycle" size={20} color={colors.primaryDark} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <AppText variant="meta" style={{ fontWeight: '700' }}>
              Delivered in 30–45 minutes
            </AppText>
            <AppText variant="caption" tone="muted">
              From {store.name} · packed with care
            </AppText>
          </View>
        </View>
      </ScrollView>

      <BottomBar>
        <View style={styles.checkoutRow}>
          <View style={{ gap: 0 }}>
            <AppText variant="caption" tone="muted">
              Total
            </AppText>
            <AppText variant="price" style={{ fontSize: 21 }}>
              {money(total)}
            </AppText>
          </View>
          <Button
            label="Checkout"
            onPress={() => router.push('/checkout')}
            iconRight="arrow-forward"
            style={styles.checkoutButton}
          />
        </View>
      </BottomBar>
    </View>
  );
}

const styles = themedStyles((colors) => StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  clearButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  content: { padding: 20, gap: 16, paddingBottom: 28 },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.md,
    padding: 12,
  },
  itemsCard: { overflow: 'hidden' },
  item: { flexDirection: 'row', gap: 12, padding: 14 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemImageWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImage: { width: '100%', height: '100%' },
  itemInfo: { flex: 1, gap: 10 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  billCard: { gap: 14 },
  savingsNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  deliveryNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 4,
  },
  deliveryIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  checkoutButton: { flex: 1 },
}));
