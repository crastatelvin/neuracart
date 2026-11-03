import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductCard } from '@/components/ProductCard';
import { AppText } from '@/components/ui/AppText';
import { BrandMark } from '@/components/ui/BrandMark';
import { EmptyState, ErrorState, ProductGridSkeleton } from '@/components/ui/States';
import { colors, radius, shadows } from '@/constants/design';
import { apiErrorMessage, apiPath, apiRequest, apiRequestPage } from '@/lib/api';
import { money } from '@/lib/format';
import { translate } from '@/lib/i18n';
import { useLanguageStore } from '@/store/language';
import { aiSmartSearch } from '@/lib/ai';
import { fetchRecsHome } from '@/lib/recs';
import type {
  Address,
  Pagination,
  Product,
  ProductCategory,
  RecsHome,
  RecipeDetail,
  RecipeSummary,
} from '@/lib/types';
import { PersonalRails } from '@/components/PersonalRails';
import { useAuthStore } from '@/store/auth';
import { cartDeliveryFee, cartItemCount, cartSubtotal, useCartStore } from '@/store/cart';
import { useConfigStore } from '@/store/config';

type CategoryFilter = 'all' | ProductCategory;

type FlashDeal = {
  id: string;
  discountPct: number;
  endsAt: string;
  remaining: number | null;
  product: {
    id: string;
    name: string;
    unit: string;
    price: number;
    dealPrice: number;
    imageUrl: string | null;
  };
};

const CATEGORIES: { key: CategoryFilter; labelKey: string; icon: string }[] = [
  { key: 'all', labelKey: 'home.categoryAll', icon: 'grid-outline' },
  { key: 'fruits', labelKey: 'home.categoryFruits', icon: 'nutrition-outline' },
  { key: 'vegetables', labelKey: 'home.categoryVegetables', icon: 'leaf-outline' },
  { key: 'meat', labelKey: 'home.categoryMeat', icon: 'fish-outline' },
];

const EMPTY_PAGINATION: Pagination = {
  page: 1,
  limit: 12,
  total: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const store = useConfigStore((state) => state.store);
  const language = useLanguageStore((state) => state.language);
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(language, key, vars);
  const loadStore = useConfigStore((state) => state.loadStore);
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const increment = useCartStore((state) => state.increment);
  const decrement = useCartStore((state) => state.decrement);

  const [products, setProducts] = useState<Product[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [promoVisible, setPromoVisible] = useState(true);
  const [addressLabel, setAddressLabel] = useState('Indiranagar, Bengaluru');
  const [recsHome, setRecsHome] = useState<RecsHome | null>(null);
  const [deals, setDeals] = useState<FlashDeal[]>([]);
  const [smartSearch, setSmartSearch] = useState(false);
  const requestId = useRef(0);
  const featuredLoaded = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const count = cartItemCount(items);
  const subtotal = cartSubtotal(items);
  const total = subtotal + cartDeliveryFee(subtotal, store);

  const fetchRecs = useCallback(async () => {
    if (!user) {
      setRecsHome(null);
      return;
    }
    try {
      const feed = await fetchRecsHome(itemsRef.current.map((item) => item.product.id));
      setRecsHome(feed);
    } catch {
      // Personalised rails degrade silently; the catalogue stays usable.
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchProducts = useCallback(
    async (pageToLoad: number, mode: 'replace' | 'append') => {
      const currentRequest = ++requestId.current;
      if (mode === 'replace') {
        setLoading(true);
        setSmartSearch(false);
        setError(null);
      } else {
        setLoadingMore(true);
      }
      try {
        const response = await apiRequestPage<Product>(
          apiPath('/products', {
            page: pageToLoad,
            limit: 12,
            search: debouncedQuery || undefined,
            category: category === 'all' ? undefined : category,
          }),
          { auth: false },
        );
        if (currentRequest !== requestId.current) return;
        if (mode === 'replace' && debouncedQuery && response.data.length === 0 && user) {
          // Keyword search came up empty — try the AI hybrid match (falls back
          // to lexical scoring server-side when the AI key is absent).
          try {
            const smart = await aiSmartSearch(debouncedQuery, 12);
            if (currentRequest === requestId.current && smart.length > 0) {
              setProducts(smart);
              setPagination({
                page: 1,
                limit: smart.length,
                total: smart.length,
                totalPages: 1,
                hasNext: false,
                hasPrev: false,
              });
              setSmartSearch(true);
              return;
            }
          } catch {
            // Degrade to the plain empty state.
          }
        }
        setProducts((current) => {
          if (mode === 'replace') return response.data;
          const ids = new Set(current.map((product) => product.id));
          return [...current, ...response.data.filter((product) => !ids.has(product.id))];
        });
        setPagination(response.pagination);
      } catch (caught) {
        if (currentRequest !== requestId.current) return;
        if (mode === 'replace') {
          setProducts([]);
          setError(apiErrorMessage(caught));
        }
      } finally {
        if (currentRequest === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [category, debouncedQuery, user],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchProducts(1, 'replace');
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const fetchFeatured = useCallback(async () => {
    try {
      const result = await apiRequest<Product[]>('/products/featured', { auth: false });
      setFeatured(result);
      featuredLoaded.current = true;
    } catch {
      // Featured items are a nice-to-have; the main catalogue remains usable.
    }
  }, []);

  useEffect(() => {
    if (!featuredLoaded.current) void fetchFeatured();
  }, [fetchFeatured]);

  const loadAddress = useCallback(async () => {
    try {
      const addresses = await apiRequest<Address[]>('/addresses');
      const preferred = addresses.find((address) => address.isDefault) ?? addresses[0];
      if (preferred) {
        setAddressLabel(`${preferred.label} · ${preferred.line1}`);
      }
    } catch {
      // Keep the friendly fallback label when addresses are unavailable.
    }
  }, []);

  const fetchDeals = useCallback(async () => {
    try {
      const result = await apiRequestPage<FlashDeal>('/flash-deals?limit=10');
      setDeals(result.data);
    } catch {
      setDeals([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAddress();
      void fetchRecs();
      void fetchDeals();
    }, [loadAddress, fetchRecs, fetchDeals]),
  );

  async function refresh() {
    setRefreshing(true);
    await Promise.all([fetchProducts(1, 'replace'), fetchFeatured(), loadStore(), loadAddress(), fetchRecs(), fetchDeals()]);
    setRefreshing(false);
  }

  function add(product: Product) {
    addItem(product);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  /** Add every remaining ingredient of a recipe to the cart in one tap. */
  async function addRecipe(summary: RecipeSummary) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const detail = await apiRequest<RecipeDetail>(`/recs/recipes/${summary.id}`);
      for (const item of detail.items) {
        if (quantityFor(item.product.id) >= item.quantity) continue;
        addItem({
          id: item.product.id,
          name: item.product.name,
          description: item.product.description ?? null,
          category: item.product.category as ProductCategory,
          price: String(Number(item.product.price)),
          unit: item.product.unit,
          stock: item.product.stock,
          imageUrl: item.product.imageUrl,
          isActive: true,
          isFeatured: false,
          createdAt: '',
          updatedAt: '',
        });
      }
    } catch {
      // Recipe add is best-effort; the cart stays untouched on failure.
    }
  }

  function quantityFor(productId: string): number {
    return items.find((item) => item.product.id === productId)?.quantity ?? 0;
  }

  function clearFilters() {
    setQuery('');
    setCategory('all');
  }

  const hasFilters = !!debouncedQuery || category !== 'all';
  const listHeading = hasFilters
    ? debouncedQuery
      ? t('home.resultsFor', { query: debouncedQuery })
      : CATEGORIES.find((item) => item.key === category)
        ? t(CATEGORIES.find((item) => item.key === category)!.labelKey)
        : t('home.freshPicks')
    : t('home.freshPicks');

  const hour = new Date().getHours();
  const greeting = t(
    hour < 12 ? 'home.goodMorning' : hour < 17 ? 'home.goodAfternoon' : 'home.goodEvening',
  );

  const listHeader = (
    <View>
      <LinearGradient
        colors={['#14532D', '#15803D', '#16A34A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.heroBubbleOne} />
        <View style={styles.heroBubbleTwo} />
        <View style={styles.brandRow}>
          <View style={styles.brandLockup}>
            <BrandMark size={36} light />
            <View style={{ gap: 0 }}>
              <AppText variant="section" tone="white" style={{ letterSpacing: -0.5 }}>
                NeuraCart
              </AppText>
              <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {t('home.tagline')}
              </AppText>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open cart${count ? `, ${count} items` : ''}`}
            onPress={() => router.push('/cart')}
            style={({ pressed }) => [styles.cartButton, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="bag-handle-outline" size={22} color={colors.primaryDark} />
            {count > 0 ? (
              <View style={styles.cartBadge}>
                <AppText style={styles.cartBadgeText}>{count > 9 ? '9+' : count}</AppText>
              </View>
            ) : null}
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Deliver to ${addressLabel}`}
          onPress={() => router.push('/addresses')}
          style={({ pressed }) => [styles.locationRow, pressed && { opacity: 0.75 }]}
        >
          <View style={styles.locationIcon}>
            <Ionicons name="location" size={14} color={colors.white} />
          </View>
          <View style={styles.locationText}>
            <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.64)' }}>
              {t('home.deliverTo')}
            </AppText>
            <AppText variant="meta" tone="white" numberOfLines={1} style={{ fontWeight: '700' }}>
              {addressLabel}
            </AppText>
          </View>
          <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.76)" />
        </Pressable>

        <View style={styles.greetingRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="title" tone="white" style={styles.greeting}>
              {greeting}, {user?.name?.split(' ')[0] || 'there'}
            </AppText>
            <AppText variant="body" style={{ color: 'rgba(255,255,255,0.78)' }}>
              {t('home.freshToday')}
            </AppText>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('home.searchPlaceholder')}
            placeholderTextColor={colors.subtle}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search products"
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery('')}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={19} color={colors.subtle} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open the NeuraCart assistant"
          onPress={() => router.push('/assistant')}
          style={({ pressed }) => [styles.assistantPill, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="sparkles" size={14} color={colors.primaryDark} />
          <AppText style={styles.assistantPillText}>{t('home.askAssistant')}</AppText>
        </Pressable>

        <View style={styles.heroMeta}>
          <View style={styles.metaPill}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: store.isOpen ? '#86EFAC' : '#FCA5A5' },
              ]}
            />
            <AppText variant="caption" style={styles.metaText}>
              {store.isOpen
                ? t('common.openTill', { time: formatHour(store.closeTime) })
                : t('common.closed')}
            </AppText>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaPill}>
            <Ionicons name="bicycle-outline" size={14} color="rgba(255,255,255,0.8)" />
            <AppText variant="caption" style={styles.metaText}>
              {t('common.freeDeliveryOver', { amount: money(store.freeDeliveryAbove) })}
            </AppText>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.bodyTop}>
        {promoVisible && !hasFilters ? (
          <LinearGradient
            colors={['#FFFBEB', '#FEF3C7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.promo}
          >
            <View style={styles.promoIcon}>
              <Ionicons name="leaf" size={22} color={colors.warning} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyMedium" style={{ fontWeight: '700', color: '#92400E' }}>
                {t('home.promoTitle')}
              </AppText>
              <AppText variant="caption" style={{ color: '#A16207' }}>
                {t('home.promoBody')}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss offer"
              onPress={() => setPromoVisible(false)}
              hitSlop={8}
            >
              <Ionicons name="close" size={17} color="#B45309" />
            </Pressable>
          </LinearGradient>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {CATEGORIES.map((item) => {
            const active = category === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Browse ${t(item.labelKey)}`}
                onPress={() => setCategory(item.key)}
                style={({ pressed }) => [
                  styles.category,
                  active && styles.categoryActive,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <View style={[styles.categoryIcon, active && styles.categoryIconActive]}>
                  <Ionicons
                    name={item.icon as never}
                    size={17}
                    color={active ? colors.white : colors.primaryDark}
                  />
                </View>
                <AppText
                  variant="meta"
                  style={{
                    color: active ? colors.white : colors.textSecondary,
                    fontWeight: '700',
                  }}
                >
                  {t(item.labelKey)}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        {store?.weatherMode && store.weatherMode !== 'NORMAL' ? (
          <View style={styles.weatherBanner}>
            <Ionicons name="rainy" size={16} color="#92400E" />
            <AppText variant="caption" style={{ color: '#92400E', flex: 1 }}>
              {store.weatherNote || 'Rainy conditions'} · {t('home.weatherSuffix')}
            </AppText>
          </View>
        ) : null}

        {deals.length > 0 && !hasFilters ? (
          <View style={styles.featuredSection}>
            <View style={styles.sectionHeading}>
              <View style={{ gap: 1 }}>
                <AppText variant="section">{t('home.flashDeals')}</AppText>
                <AppText variant="caption" tone="muted">
                  {t('home.flashDealsSub')}
                </AppText>
              </View>
              <View style={styles.sparkle}>
                <Ionicons name="pricetag" size={14} color={colors.primaryDark} />
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredRow}
            >
              {deals.map((deal) => (
                <Pressable
                  key={deal.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${deal.product.name}, ${deal.discountPct}% off`}
                  onPress={() => router.push(`/product/${deal.product.id}`)}
                  style={({ pressed }) => [styles.dealCard, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.dealBadge}>
                    <AppText variant="caption" tone="white" style={{ fontWeight: '800' }}>
                      {deal.discountPct}% off
                    </AppText>
                  </View>
                  <AppText variant="bodyMedium" numberOfLines={2} style={{ fontWeight: '700' }}>
                    {deal.product.name}
                  </AppText>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <AppText variant="price" style={{ fontSize: 16 }}>
                      {money(deal.product.dealPrice)}
                    </AppText>
                    <AppText
                      variant="caption"
                      tone="subtle"
                      style={{ textDecorationLine: 'line-through' }}
                    >
                      {money(deal.product.price)}
                    </AppText>
                  </View>
                  <AppText variant="caption" tone="muted">
                    {deal.product.unit}
                    {deal.remaining !== null ? ` · ${deal.remaining} left` : ''}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {featured.length > 0 && !hasFilters ? (
          <View style={styles.featuredSection}>
            <View style={styles.sectionHeading}>
              <View style={{ gap: 1 }}>
                <AppText variant="section">{t('home.handpicked')}</AppText>
                <AppText variant="caption" tone="muted">
                  {t('home.handpickedSub')}
                </AppText>
              </View>
              <View style={styles.sparkle}>
                <Ionicons name="sparkles" size={14} color={colors.primaryDark} />
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredRow}
            >
              {featured.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={quantityFor(product.id)}
                  horizontal
                  onPress={() => router.push(`/product/${product.id}`)}
                  onAdd={() => add(product)}
                  onIncrement={() => increment(product.id)}
                  onDecrement={() => decrement(product.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {recsHome && !hasFilters ? <PersonalRails
          feeds={recsHome}
          quantityFor={(productId: string) => quantityFor(productId)}
          onPressProduct={(productId: string) => router.push(`/product/${productId}`)}
          onAdd={add}
          onIncrement={increment}
          onDecrement={decrement}
          onAddRecipe={(recipe: RecipeSummary) => void addRecipe(recipe)}
        /> : null}

        <View style={styles.productsHeading}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="section">{listHeading}</AppText>
            {smartSearch ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="sparkles" size={12} color={colors.primaryDark} />
                <AppText variant="caption" style={{ color: colors.primaryDark, fontWeight: '700' }}>
                  {t('home.smartMatches')}
                </AppText>
              </View>
            ) : (
              <AppText variant="caption" tone="muted">
                {loading
                  ? t('home.gathering')
                  : pagination.total === 1
                    ? t('common.itemSingular')
                    : t('home.itemsAvailable', { count: pagination.total })}
              </AppText>
            )}
          </View>
          {hasFilters ? (
            <Pressable onPress={clearFilters} hitSlop={8}>
              <AppText variant="meta" tone="primary" style={{ fontWeight: '700' }}>
                {t('common.clear')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.fill}>
      <StatusBar style="light" />
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <ProductCard
              product={item}
              quantity={quantityFor(item.id)}
              onPress={() => router.push(`/product/${item.id}`)}
              onAdd={() => add(item)}
              onIncrement={() => increment(item.id)}
              onDecrement={() => decrement(item.id)}
            />
          </View>
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          loading ? (
            <ProductGridSkeleton />
          ) : error ? (
            <ErrorState description={error} onRetry={() => fetchProducts(1, 'replace')} />
          ) : (
            <EmptyState
              icon="search-outline"
              title={t('home.emptyTitle')}
              description={
                hasFilters ? t('home.emptyFilterBody') : t('home.emptyRestockBody')
              }
              actionLabel={hasFilters ? t('common.clearFilters') : undefined}
              onAction={hasFilters ? clearFilters : undefined}
            />
          )
        }
        columnWrapperStyle={products.length > 0 ? styles.gridRow : undefined}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={() => {
          if (pagination.hasNext && !loading && !loadingMore) {
            void fetchProducts(pagination.page + 1, 'append');
          }
        }}
        onEndReachedThreshold={0.45}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : pagination.hasNext || products.length === 0 ? (
            <View style={{ height: count > 0 ? 96 : 24 }} />
          ) : (
            <View style={styles.caughtUp}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.subtle} />
              <AppText variant="caption" tone="subtle">
                {t('common.allCaughtUp')}
              </AppText>
              <View style={{ height: count > 0 ? 84 : 12 }} />
            </View>
          )
        }
      />

      {count > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View cart, ${count} items, ${money(total)}`}
          onPress={() => router.push('/cart')}
          style={({ pressed }) => [styles.cartBar, pressed && { opacity: 0.94 }]}
        >
          <View style={styles.cartBarCount}>
            <Ionicons name="bag-handle" size={19} color={colors.white} />
            <View style={styles.cartCountBubble}>
              <AppText style={styles.cartCountText}>{count}</AppText>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="meta" tone="white" style={{ fontWeight: '700' }}>
              {t('common.viewCart')}
            </AppText>
            <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.72)' }}>
              {count === 1 ? t('common.itemSingular') : t('common.itemsCount', { count })} ·{' '}
              {money(total)}
            </AppText>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

function formatHour(time: string): string {
  const [hourPart] = time.split(':');
  const hour = Number(hourPart);
  if (!Number.isFinite(hour)) return time;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12} ${suffix}`;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingBottom: 12 },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroBubbleOne: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.055)',
    right: -60,
    top: -70,
  },
  heroBubbleTwo: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.05)',
    left: -60,
    bottom: 20,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#15803D',
  },
  cartBadgeText: { color: colors.white, fontSize: 9, fontWeight: '800', lineHeight: 12 },
  locationRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '92%',
  },
  locationIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: { flex: 1, gap: 0 },
  greetingRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center' },
  greeting: { fontSize: 25, lineHeight: 31 },
  searchBar: {
    marginTop: 18,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 9,
    ...shadows.card,
  },
  assistantPill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  assistantPillText: { color: colors.primaryDark, fontWeight: '800', fontSize: 12 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 13,
  },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: 'rgba(255,255,255,0.76)' },
  metaDivider: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  bodyTop: { paddingHorizontal: 20, paddingTop: 16 },
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.lg,
    padding: 13,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  promoIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categories: { gap: 8, paddingVertical: 18, paddingRight: 8 },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 40,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  categoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconActive: { backgroundColor: 'rgba(255,255,255,0.16)' },
  featuredSection: { marginBottom: 20 },
  weatherBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: '#FEF3C7',
  },
  dealCard: {
    width: 168,
    gap: 5,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  dealBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sparkle: {
    width: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredRow: { gap: 12, paddingRight: 8 },
  productsHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
    gap: 10,
  },
  gridRow: { gap: 12, paddingHorizontal: 20, marginBottom: 12 },
  gridItem: { flex: 1 },
  footerLoading: { paddingVertical: 24, alignItems: 'center' },
  caughtUp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 5,
    paddingTop: 18,
  },
  cartBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 12,
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.primaryDeep,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    ...shadows.floating,
  },
  cartBarCount: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCountBubble: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCountText: { color: colors.white, fontSize: 9, fontWeight: '800', lineHeight: 11 },
});
