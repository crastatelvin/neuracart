import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, shadows } from '@/constants/design';
import { formatShortDate, money } from '@/lib/format';
import type { Order } from '@/lib/types';
import { AppText } from './ui/AppText';
import { StatusPill } from './OrderBits';

export function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const thumbs = order.items.slice(0, 3);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.orderNumber}, ${order.status}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.topRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="card">#{order.orderNumber}</AppText>
          <AppText variant="caption" tone="subtle">
            {formatShortDate(order.createdAt)} · {order.itemCount} items
          </AppText>
        </View>
        <StatusPill status={order.status} compact />
      </View>

      <View style={styles.middle}>
        <View style={styles.thumbs}>
          {thumbs.map((item, index) => (
            <View
              key={item.id}
              style={[styles.thumb, { marginLeft: index === 0 ? 0 : -10, zIndex: 3 - index }]}
            >
              {item.product.imageUrl ? (
                <Image
                  source={{ uri: item.product.imageUrl }}
                  style={styles.thumbImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <Ionicons name="leaf-outline" size={18} color={colors.primary} />
              )}
            </View>
          ))}
          {order.items.length > 3 ? (
            <View style={[styles.thumb, styles.more, { marginLeft: -10 }]}>
              <AppText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
                +{order.items.length - 3}
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.address}>
          <Ionicons name="location-outline" size={14} color={colors.muted} />
          <AppText variant="meta" tone="muted" numberOfLines={1}>
            {order.address.city} · {order.address.pincode}
          </AppText>
        </View>
      </View>

      {order.status === 'cancelled' && order.cancelReason ? (
        <View style={styles.cancelNote}>
          <Ionicons name="information-circle-outline" size={14} color={colors.danger} />
          <AppText variant="caption" tone="danger" numberOfLines={1} style={{ flex: 1 }}>
            {order.cancelReason}
          </AppText>
        </View>
      ) : null}

      <View style={styles.footer}>
        <View>
          <AppText variant="caption" tone="subtle">
            Total
          </AppText>
          <AppText variant="card" style={{ color: colors.primaryDark }}>
            {money(order.total)}
          </AppText>
        </View>
        <View style={styles.view}>
          <AppText variant="meta" tone="primary" style={{ fontWeight: '700' }}>
            View details
          </AppText>
          <Ionicons name="chevron-forward" size={16} color={colors.primaryDark} />
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
    padding: 16,
    gap: 12,
    ...shadows.card,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  middle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  thumbs: { flexDirection: 'row', alignItems: 'center' },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  more: { backgroundColor: colors.primaryMuted },
  address: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end' },
  cancelNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  view: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
