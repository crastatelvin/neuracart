import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ProductCard } from '@/components/ProductCard';
import { AppText } from '@/components/ui/AppText';
import { colors, radius, shadows } from '@/constants/design';
import { money } from '@/lib/format';
import { cardToProduct, URGENCY_LABEL, URGENCY_TONE } from '@/lib/recs';
import type { RecsHome, RecipeSummary } from '@/lib/types';

type Props = {
  feeds: RecsHome;
  quantityFor: (productId: string) => number;
  onPressProduct: (productId: string) => void;
  onAdd: (product: ReturnType<typeof cardToProduct>) => void;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onAddRecipe: (summary: RecipeSummary) => void;
};

const RAIL_HEADINGS = {
  buyAgain: { title: 'Buy again', caption: 'Your recent favourites, one tap away' },
  together: { title: 'Goes well with', caption: 'Often bought together' },
} as const;

export function PersonalRails({
  feeds,
  quantityFor,
  onPressProduct,
  onAdd,
  onIncrement,
  onDecrement,
  onAddRecipe,
}: Props) {
  const hasReorder = feeds.reorder.length > 0;
  const hasBuyAgain = feeds.buyAgain.length > 0;
  const hasTogether = feeds.together.length > 0;
  const hasRecipes = feeds.recipes.length > 0;
  if (!hasReorder && !hasBuyAgain && !hasTogether && !hasRecipes) return null;

  return (
    <View style={styles.wrap}>
      {feeds.headline ? (
        <View style={styles.headlineBanner}>
          <Ionicons name="sparkles" size={15} color={colors.primaryDark} />
          <AppText variant="meta" style={styles.headlineText} numberOfLines={1}>
            {feeds.headline}
          </AppText>
        </View>
      ) : null}

      {hasReorder ? (
        <View style={styles.block}>
          <View style={styles.headingRow}>
            <View style={{ flex: 1 }}>
              <AppText variant="section">Reorder</AppText>
              <AppText variant="caption" tone="muted">
                You’re likely running low on these
              </AppText>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {feeds.reorder.map((entry) => {
              const tone = URGENCY_TONE[entry.urgency];
              const quantity = quantityFor(entry.id);
              return (
                <View key={`reorder-${entry.id}`} style={styles.chip}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Reorder ${entry.name}`}
                    onPress={() => onPressProduct(entry.id)}
                  >
                    <View style={styles.chipTop}>
                      <AppText variant="meta" numberOfLines={1} style={{ fontWeight: '700', maxWidth: 110 }}>
                        {entry.name}
                      </AppText>
                      <View style={[styles.urgencyPill, { backgroundColor: tone.bg }]}>
                        <AppText style={[styles.urgencyText, { color: tone.text }]}>
                          {URGENCY_LABEL[entry.urgency]}
                        </AppText>
                      </View>
                    </View>
                    <AppText variant="caption" tone="muted">
                      {money(entry.price)} · {entry.unit}
                    </AppText>
                  </Pressable>
                  {quantity === 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${entry.name} to cart`}
                      onPress={() => onAdd(cardToProduct(entry))}
                      style={styles.chipAdd}
                      hitSlop={6}
                    >
                      <Ionicons name="add" size={16} color={colors.white} />
                    </Pressable>
                  ) : (
                    <View style={styles.chipStepper}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove one ${entry.name}`}
                        onPress={() => onDecrement(entry.id)}
                        hitSlop={6}
                      >
                        <Ionicons name="remove" size={15} color={colors.white} />
                      </Pressable>
                      <AppText style={styles.chipQty}>{quantity}</AppText>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Add one more ${entry.name}`}
                        onPress={() => onIncrement(entry.id)}
                        hitSlop={6}
                      >
                        <Ionicons name="add" size={15} color={colors.white} />
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {hasBuyAgain ? <ProductRail
        heading={RAIL_HEADINGS.buyAgain}
        products={feeds.buyAgain}
        quantityFor={quantityFor}
        onPressProduct={onPressProduct}
        onAdd={onAdd}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
      /> : null}

      {hasTogether ? <ProductRail
        heading={RAIL_HEADINGS.together}
        products={feeds.together}
        quantityFor={quantityFor}
        onPressProduct={onPressProduct}
        onAdd={onAdd}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
      /> : null}

      {hasRecipes ? (
        <View style={styles.block}>
          <View style={styles.headingRow}>
            <View style={{ flex: 1 }}>
              <AppText variant="section">Cook something tonight</AppText>
              <AppText variant="caption" tone="muted">
                Add every ingredient at once
              </AppText>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recipeRow}
          >
            {feeds.recipes.map((recipe) => (
              <Pressable
                key={`recipe-${recipe.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Cook ${recipe.title}`}
                onPress={() => onAddRecipe(recipe)}
                style={({ pressed }) => [styles.recipeCard, pressed && { opacity: 0.9 }]}
              >
                {recipe.imageUrl ? (
                  <Image source={{ uri: recipe.imageUrl }} style={styles.recipeImage} />
                ) : (
                  <View style={[styles.recipeImage, styles.recipeImageFallback]}>
                    <Ionicons name="restaurant-outline" size={26} color={colors.primaryDark} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 3 }}>
                  <AppText variant="meta" numberOfLines={1} style={{ fontWeight: '700' }}>
                    {recipe.title}
                  </AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={2}>
                    {recipe.description ?? `${recipe.servings} servings`}
                  </AppText>
                </View>
                <View style={styles.recipeCta}>
                  <Ionicons name="basket-outline" size={13} color={colors.white} />
                  <AppText style={styles.recipeCtaText}>Add all</AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

type RailProps = {
  heading: { title: string; caption: string };
  products: RecsHome['buyAgain'];
  quantityFor: Props['quantityFor'];
  onPressProduct: Props['onPressProduct'];
  onAdd: Props['onAdd'];
  onIncrement: Props['onIncrement'];
  onDecrement: Props['onDecrement'];
};

function ProductRail({
  heading,
  products,
  quantityFor,
  onPressProduct,
  onAdd,
  onIncrement,
  onDecrement,
}: RailProps) {
  return (
    <View style={styles.block}>
      <View style={styles.headingRow}>
        <View style={{ flex: 1 }}>
          <AppText variant="section">{heading.title}</AppText>
          <AppText variant="caption" tone="muted">
            {heading.caption}
          </AppText>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardRow}
      >
        {products.map((card) => (
          <ProductCard
            key={`rail-${card.id}`}
            product={cardToProduct(card)}
            quantity={quantityFor(card.id)}
            horizontal
            onPress={() => onPressProduct(card.id)}
            onAdd={() => onAdd(cardToProduct(card))}
            onIncrement={() => onIncrement(card.id)}
            onDecrement={() => onDecrement(card.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18, marginBottom: 18 },
  block: { gap: 10 },
  headlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignSelf: 'flex-start',
  },
  headlineText: { color: colors.primaryDark, fontWeight: '700' },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  chipsRow: { gap: 9, paddingRight: 8 },
  chip: {
    width: 168,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 11,
    gap: 6,
    ...shadows.card,
  },
  chipTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  urgencyPill: {
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  urgencyText: { fontSize: 9.5, fontWeight: '800', lineHeight: 13 },
  chipAdd: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  chipStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-end',
  },
  chipQty: { color: colors.white, fontSize: 12.5, fontWeight: '800', minWidth: 14, textAlign: 'center' },
  cardRow: { gap: 12, paddingRight: 8 },
  recipeRow: { gap: 10, paddingRight: 8 },
  recipeCard: {
    width: 216,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 11,
    gap: 8,
    ...shadows.card,
  },
  recipeImage: {
    height: 92,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  recipeImageFallback: { alignItems: 'center', justifyContent: 'center' },
  recipeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 7,
  },
  recipeCtaText: { color: colors.white, fontSize: 11.5, fontWeight: '800' },
});
