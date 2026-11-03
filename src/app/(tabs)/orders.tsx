import { colors, radius, themedStyles } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrderCard } from '@/components/OrderCard';
import { AppText } from '@/components/ui/AppText';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { apiErrorMessage, apiPath, apiRequestPage } from '@/lib/api';
import type { Order, Pagination } from '@/lib/types';
import { cartItemCount, useCartStore } from '@/store/cart';

const EMPTY_PAGINATION: Pagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cartCount = useCartStore((state) => cartItemCount(state.items));
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchOrders = useCallback(async (page: number, mode: 'replace' | 'append') => {
    const current = ++requestId.current;
    if (mode === 'replace') {
      setError(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const response = await apiRequestPage<Order>(
        apiPath('/orders/my', { page, limit: 10 }),
      );
      if (current !== requestId.current) return;
      setOrders((existing) => {
        if (mode === 'replace') return response.data;
        const ids = new Set(existing.map((order) => order.id));
        return [...existing, ...response.data.filter((order) => !ids.has(order.id))];
      });
      setPagination(response.pagination);
    } catch (caught) {
      if (current !== requestId.current) return;
      if (mode === 'replace') {
        setError(apiErrorMessage(caught));
        setOrders([]);
      }
    } finally {
      if (current === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchOrders(1, 'replace');
    }, [fetchOrders]),
  );

  async function refresh() {
    setRefreshing(true);
    await fetchOrders(1, 'replace');
    setRefreshing(false);
  }

  return (
    <View style={styles.fill}>
      <StatusBar style="auto" />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, gap: 3 }}>
            <AppText variant="title">My orders</AppText>
            <AppText variant="body" tone="muted">
              Track your fresh deliveries
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open cart${cartCount ? `, ${cartCount} items` : ''}`}
            onPress={() => router.push('/cart')}
            style={({ pressed }) => [styles.cartButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="bag-handle-outline" size={21} color={colors.text} />
            {cartCount > 0 ? (
              <View style={styles.cartBadge}>
                <AppText style={styles.cartBadgeText}>{cartCount}</AppText>
              </View>
            ) : null}
          </Pressable>
        </View>
        {!loading && orders.length > 0 ? (
          <View style={styles.summaryPill}>
            <Ionicons name="receipt-outline" size={14} color={colors.primaryDark} />
            <AppText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
              {pagination.total} {pagination.total === 1 ? 'order' : 'orders'} in your history
            </AppText>
          </View>
        ) : null}
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OrderCard order={item} onPress={() => router.push(`/order/${item.id}`)} />
        )}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <AppText variant="meta" tone="muted">
                Fetching your orders…
              </AppText>
            </View>
          ) : error ? (
            <ErrorState description={error} onRetry={() => fetchOrders(1, 'replace')} />
          ) : (
            <EmptyState
              icon="receipt-outline"
              title="No orders yet"
              description="Your order history will appear here once you place your first NeuraCart order."
              actionLabel="Start shopping"
              onAction={() => router.replace('/(tabs)')}
            />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        onEndReached={() => {
          if (pagination.hasNext && !loading && !loadingMore) {
            void fetchOrders(pagination.page + 1, 'append');
          }
        }}
        onEndReachedThreshold={0.45}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={{ height: 24 }} />
          )
        }
      />
    </View>
  );
}

const styles = themedStyles((colors) => StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cartButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { color: colors.white, fontSize: 9, lineHeight: 11, fontWeight: '800' },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  content: { padding: 20, flexGrow: 1 },
  loading: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  footer: { paddingVertical: 24, alignItems: 'center' },
}));
