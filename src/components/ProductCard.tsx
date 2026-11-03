import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, shadows } from '@/constants/design';
import { categoryLabel, money } from '@/lib/format';
import type { Product } from '@/lib/types';
import { AppText } from './ui/AppText';
import { Badge } from './ui/Badge';
import { QuantityStepper } from './ui/QuantityStepper';

type Props = {
  product: Product;
  quantity: number;
  onPress: () => void;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  horizontal?: boolean;
};

export function ProductCard({
  product,
  quantity,
  onPress,
  onAdd,
  onIncrement,
  onDecrement,
  horizontal = false,
}: Props) {
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 5;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${product.name}, ${money(product.price)} per ${product.unit}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        horizontal ? styles.horizontal : styles.grid,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.imageWrap, horizontal ? styles.horizontalImage : styles.gridImage]}>
        {product.imageUrl ? (
          <Image
            source={{ uri: product.imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={160}
            cachePolicy="memory-disk"
            accessibilityLabel={product.name}
          />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="leaf-outline" size={32} color={colors.primary} />
          </View>
        )}
        {outOfStock ? <View style={styles.outOverlay} /> : null}
        {product.isFeatured ? (
          <View style={styles.featured}>
            <Ionicons name="sparkles" size={10} color={colors.primaryDark} />
            <AppText variant="caption" style={styles.featuredText}>
              Featured
            </AppText>
          </View>
        ) : null}
        {outOfStock ? (
          <View style={styles.outBadge}>
            <AppText variant="caption" tone="white" style={{ fontWeight: '700' }}>
              Out of stock
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Badge label={categoryLabel(product.category)} tone="gray" />
        </View>
        <AppText variant="card" numberOfLines={2} style={styles.name}>
          {product.name}
        </AppText>
        <AppText variant="meta" tone="muted">
          {product.unit}
        </AppText>
        <View style={styles.bottomRow}>
          <View style={styles.priceBlock}>
            <AppText variant="price">{money(product.price)}</AppText>
            {lowStock ? (
              <AppText variant="caption" style={styles.lowStock}>
                Only {product.stock} left
              </AppText>
            ) : null}
          </View>
          {outOfStock ? (
            <View style={styles.disabledAdd}>
              <Ionicons name="add" size={18} color={colors.subtle} />
            </View>
          ) : quantity > 0 ? (
            <QuantityStepper
              quantity={quantity}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              max={product.stock}
              compact
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add ${product.name} to cart`}
              onPress={(event) => {
                event.stopPropagation();
                onAdd();
              }}
              hitSlop={8}
              style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.75 }]}
            >
              <Ionicons name="add" size={19} color={colors.white} />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  grid: { flex: 1 },
  horizontal: { width: 168 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  imageWrap: { backgroundColor: colors.primarySoft, position: 'relative' },
  gridImage: { height: 128 },
  horizontalImage: { height: 118 },
  image: { width: '100%', height: '100%' },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  outOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  featured: {
    position: 'absolute',
    left: 8,
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  featuredText: { color: colors.primaryDark, fontWeight: '700' },
  outBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: 'rgba(17,24,39,0.78)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  body: { padding: 10, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 1 },
  name: { minHeight: 38 },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 3,
  },
  priceBlock: { flex: 1, gap: 1 },
  lowStock: { color: colors.warning, fontWeight: '600' },
  addButton: {
    width: 33,
    height: 33,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledAdd: {
    width: 33,
    height: 33,
    borderRadius: 12,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
