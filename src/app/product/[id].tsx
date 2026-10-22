import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductCard } from '@/components/ProductCard';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { BottomBar } from '@/components/ui/BottomBar';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { colors, radius, shadows } from '@/constants/design';
import { apiErrorMessage, apiPath, apiRequest, apiRequestPage } from '@/lib/api';
import { categoryLabel, money } from '@/lib/format';
import type { Product } from '@/lib/types';
import { cartItemCount, cartSubtotal, useCartStore } from '@/store/cart';
import { useConfigStore } from '@/store/config';

export default function ProductDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const productId = String(params.id ?? '');
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const increment = useCartStore((state) => state.increment);
  const decrement = useCartStore((state) => state.decrement);
  const store = useConfigStore((state) => state.store);

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<Product>(`/products/${productId}`, { auth: false });
      setProduct(result);
      try {
        const categoryResult = await apiRequestPage<Product>(
          apiPath('/products', { category: result.category, limit: 8 }),
          { auth: false },
        );
        setRelated(categoryResult.data.filter((item) => item.id !== result.id).slice(0, 6));
      } catch {
        setRelated([]);
      }
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!productId) return;
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const quantity = items.find((item) => item.product.id === productId)?.quantity ?? 0;
  const count = cartItemCount(items);
  const subtotal = cartSubtotal(items);

  if (loading) {
    return (
      <View style={styles.fill}>
        <StatusBar style="dark" />
        <View style={[styles.loadingHeader, { paddingTop: insets.top + 10 }]}>
          <Pressable
            onPress={() => router.back()}
            style={styles.loadingBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={21} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="meta" tone="muted">
            Fetching today’s freshness…
          </AppText>
        </View>
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={styles.fill}>
        <StatusBar style="dark" />
        <View style={[styles.loadingHeader, { paddingTop: insets.top + 10 }]}>
          <Pressable
            onPress={() => router.back()}
            style={styles.loadingBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={21} color={colors.text} />
          </Pressable>
        </View>
        <ErrorState
          title="This item isn’t available"
          description={error ?? 'The product may have sold out or been removed.'}
          onRetry={load}
        />
      </View>
    );
  }

  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 5;

  function add() {
    if (!product) return;
    addItem(product);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  return (
    <View style={styles.fill}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View style={styles.imageWrap}>
          {product.imageUrl ? (
            <Image
              source={{ uri: product.imageUrl }}
              style={styles.image}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              accessibilityLabel={product.name}
            />
          ) : (
            <LinearGradient
              colors={['#14532D', '#16A34A']}
              style={styles.imageFallback}
            >
              <Ionicons name="leaf-outline" size={92} color="rgba(255,255,255,0.4)" />
            </LinearGradient>
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'transparent']}
            style={styles.topShade}
          />
          <View style={[styles.overlayHeader, { paddingTop: insets.top + 10 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.circleButton, pressed && { opacity: 0.78 }]}
            >
              <Ionicons name="arrow-back" size={21} color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open cart${count ? `, ${count} items` : ''}`}
              onPress={() => router.push('/cart')}
              style={({ pressed }) => [styles.circleButton, pressed && { opacity: 0.78 }]}
            >
              <Ionicons name="bag-handle-outline" size={21} color={colors.text} />
              {count > 0 ? (
                <View style={styles.cartBadge}>
                  <AppText style={styles.cartBadgeText}>{count}</AppText>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        <View style={styles.contentCard}>
          <View style={styles.categoryRow}>
            <Badge label={categoryLabel(product.category)} tone="green" />
            {product.isFeatured ? (
              <Badge label="Featured" tone="amber" icon="sparkles" />
            ) : null}
          </View>

          <View style={styles.titleRow}>
            <View style={{ flex: 1, gap: 5 }}>
              <AppText variant="title" style={{ fontSize: 27, lineHeight: 32 }}>
                {product.name}
              </AppText>
              <AppText variant="body" tone="muted">
                Sold by {store.name} · {product.unit}
              </AppText>
            </View>
          </View>

          <View style={styles.priceRow}>
            <View style={{ gap: 2 }}>
              <AppText variant="price" style={{ fontSize: 26, lineHeight: 31 }}>
                {money(product.price)}
              </AppText>
              <AppText variant="caption" tone="muted">
                Inclusive of all taxes
              </AppText>
            </View>
            <View
              style={[
                styles.stockPill,
                outOfStock && styles.stockPillOut,
                lowStock && styles.stockPillLow,
              ]}
            >
              <View
                style={[
                  styles.stockDot,
                  outOfStock && { backgroundColor: colors.danger },
                  lowStock && { backgroundColor: colors.warning },
                ]}
              />
              <AppText
                variant="caption"
                style={{
                  fontWeight: '700',
                  color: outOfStock
                    ? colors.danger
                    : lowStock
                      ? colors.warning
                      : colors.primaryDark,
                }}
              >
                {outOfStock
                  ? 'Out of stock'
                  : lowStock
                    ? `Only ${product.stock} left`
                    : 'In stock'}
              </AppText>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.descriptionBlock}>
            <AppText variant="section">About this item</AppText>
            <AppText variant="body" tone="muted" style={styles.description}>
              {product.description ||
                `Fresh ${product.name.toLowerCase()} from our neighbourhood store, selected with care and packed the same day.`}
            </AppText>
          </View>

          <View style={styles.perks}>
            <Perk icon="bicycle-outline" title="Quick local delivery" copy="At your door in 30–45 minutes" />
            <Perk
              icon="leaf-outline"
              title="Freshness promise"
              copy="Not happy? We’ll make it right"
            />
            <Perk
              icon="wallet-outline"
              title="Free delivery"
              copy={`On orders over ${money(store.freeDeliveryAbove)}`}
            />
          </View>

          {related.length > 0 ? (
            <View style={styles.related}>
              <View style={styles.relatedHeading}>
                <AppText variant="section">You may also like</AppText>
                <AppText variant="caption" tone="muted">
                  More from {categoryLabel(product.category).toLowerCase()}
                </AppText>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.relatedRow}
              >
                {related.map((item) => {
                  const relatedQuantity =
                    items.find((cartItem) => cartItem.product.id === item.id)?.quantity ?? 0;
                  return (
                    <ProductCard
                      key={item.id}
                      product={item}
                      quantity={relatedQuantity}
                      horizontal
                      onPress={() => router.push(`/product/${item.id}`)}
                      onAdd={() => {
                        addItem(item);
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      onIncrement={() => increment(item.id)}
                      onDecrement={() => decrement(item.id)}
                    />
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <BottomBar>
        {outOfStock ? (
          <Button label="Out of stock" onPress={() => undefined} disabled />
        ) : quantity > 0 ? (
          <View style={styles.cartActions}>
            <QuantityStepper
              quantity={quantity}
              onIncrement={() => increment(product.id)}
              onDecrement={() => decrement(product.id)}
              max={product.stock}
            />
            <Button
              label={`View cart · ${money(subtotal)}`}
              onPress={() => router.push('/cart')}
              icon="bag-handle-outline"
              style={styles.cartButton}
            />
          </View>
        ) : (
          <View style={styles.addActions}>
            <View style={styles.bottomPrice}>
              <AppText variant="caption" tone="muted">
                {product.unit}
              </AppText>
              <AppText variant="card" style={{ color: colors.primaryDark, fontSize: 17 }}>
                {money(product.price)}
              </AppText>
            </View>
            <Button
              label="Add to cart"
              onPress={add}
              icon="add"
              style={styles.addButton}
            />
          </View>
        )}
      </BottomBar>
    </View>
  );
}

function Perk({
  icon,
  title,
  copy,
}: {
  icon: string;
  title: string;
  copy: string;
}) {
  return (
    <View style={styles.perk}>
      <View style={styles.perkIcon}>
        <Ionicons name={icon as never} size={18} color={colors.primaryDark} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText variant="meta" style={{ fontWeight: '700' }}>
          {title}
        </AppText>
        <AppText variant="caption" tone="muted">
          {copy}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  loadingHeader: { paddingHorizontal: 20, paddingBottom: 10 },
  loadingBack: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  imageWrap: { height: 360, backgroundColor: colors.primarySoft, position: 'relative' },
  image: { width: '100%', height: '100%' },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topShade: { position: 'absolute', left: 0, right: 0, top: 0, height: 150 },
  overlayHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  circleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { color: colors.white, fontSize: 9, lineHeight: 11, fontWeight: '800' },
  contentCard: {
    marginTop: -24,
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 22,
    gap: 18,
  },
  categoryRow: { flexDirection: 'row', gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  stockPillLow: { backgroundColor: colors.warningSoft },
  stockPillOut: { backgroundColor: colors.dangerSoft },
  stockDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  divider: { height: 1, backgroundColor: colors.borderStrong },
  descriptionBlock: { gap: 8 },
  description: { lineHeight: 22 },
  perks: { gap: 10 },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
  },
  perkIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  related: { gap: 12, marginTop: 2 },
  relatedHeading: { gap: 2 },
  relatedRow: { gap: 12, paddingRight: 8 },
  cartActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartButton: { flex: 1 },
  addActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bottomPrice: { flex: 1, gap: 1 },
  addButton: { flex: 1.8 },
});
