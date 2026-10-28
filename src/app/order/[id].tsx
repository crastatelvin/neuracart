import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { BillSummary, StatusPill, StatusProgress, StatusTimeline } from '@/components/OrderBits';
import { ModalSheet } from '@/components/ModalSheet';
import { AppText } from '@/components/ui/AppText';
import { Badge, IconButton } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/Header';
import { ErrorState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { colors, radius } from '@/constants/design';
import { apiErrorMessage, apiRequest } from '@/lib/api';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '@/lib/config';
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  STATUS_META,
  formatAddress,
  formatDate,
  initials,
  isActiveOrder,
  money,
  pluralize,
} from '@/lib/format';
import type { Order } from '@/lib/types';
import { useToastStore } from '@/store/toast';

export default function OrderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const orderId = String(params.id ?? '');
  const showToast = useToastStore((state) => state.show);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ productId: string; name: string } | null>(
    null,
  );
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewedProductIds, setReviewedProductIds] = useState<string[]>([]);
  const [reviewedDrafts, setReviewedDrafts] = useState<Record<string, string>>({});

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const result = await apiRequest<Order>(`/orders/${orderId}`);
        setOrder(result);
      } catch (caught) {
        if (!quiet) setError(apiErrorMessage(caught));
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    if (!orderId) return;
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load, orderId]);

  useEffect(() => {
    if (!order || !isActiveOrder(order.status)) return;
    const timer = setInterval(() => {
      void load(true);
    }, 30_000);
    return () => clearInterval(timer);
  }, [load, order]);

  // Which of this order's items already carry the customer's review.
  const orderStatus = order?.status;
  const orderKey = order?.id;
  useEffect(() => {
    if (!orderKey || orderStatus !== 'delivered') return;
    apiRequest<{ productId: string }[]>('/reviews/mine')
      .then((mine) => {
        setReviewedProductIds(mine.map((review) => review.productId));
      })
      .catch(() => setReviewedProductIds([]));
  }, [orderKey, orderStatus]);

  function setReviewedTextFor(value: string) {
    if (!reviewTarget) return;
    setReviewComment(value);
    setReviewedDrafts((current) => ({ ...current, [reviewTarget.productId]: value }));
  }

  async function submitReview() {
    if (!order || !reviewTarget || reviewSubmitting) return;
    setReviewSubmitting(true);
    try {
      await apiRequest('/reviews', {
        method: 'POST',
        body: {
          orderId: order.id,
          productId: reviewTarget.productId,
          rating: reviewRating,
          comment: reviewComment.trim() || undefined,
        },
      });
      setReviewedProductIds((current) =>
        current.includes(reviewTarget.productId)
          ? current
          : [...current, reviewTarget.productId],
      );
      setReviewTarget(null);
      setReviewComment('');
      setReviewRating(5);
      showToast('Thanks for the review!');
    } catch (caught) {
      showToast(apiErrorMessage(caught), 'error');
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }

  async function copyNumber() {
    if (!order) return;
    await Clipboard.setStringAsync(order.orderNumber);
    showToast('Order number copied');
  }

  async function cancelOrder() {
    if (!order || cancelling) return;
    if (cancelReason.trim().length < 3) {
      setCancelError('Tell us why you’re cancelling (at least 3 characters).');
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      await apiRequest<Order>(`/orders/${order.id}/cancel`, {
        method: 'POST',
        body: { reason: cancelReason.trim() },
      });
      setCancelOpen(false);
      setCancelReason('');
      await load(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Order cancelled and items restocked', 'info');
    } catch (caught) {
      setCancelError(apiErrorMessage(caught));
    } finally {
      setCancelling(false);
    }
  }

  function callRider() {
    const phone = order?.deliveryPartner?.phone;
    if (!phone) {
      showToast('Rider phone number is unavailable', 'error');
      return;
    }
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() =>
      showToast('Calling is not available on this device', 'error'),
    );
  }

  function contactSupport() {
    Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
        `Help with order ${order?.orderNumber ?? ''}`,
      )}`,
    ).catch(() => showToast('Email is not available on this device', 'error'));
  }

  if (loading) {
    return (
      <View style={styles.fill}>
        <StatusBar style="dark" />
        <ScreenHeader title="Order details" onBack={() => router.back()} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="meta" tone="muted">
            Getting your order ready…
          </AppText>
        </View>
      </View>
    );
  }

  if (!order || error) {
    return (
      <View style={styles.fill}>
        <StatusBar style="dark" />
        <ScreenHeader title="Order details" onBack={() => router.back()} />
        <ErrorState
          title="We couldn’t load this order"
          description={error ?? 'Please try again in a moment.'}
          onRetry={() => load()}
        />
      </View>
    );
  }

  const meta = STATUS_META[order.status];
  const canCancel = order.status === 'pending' || order.status === 'confirmed';
  const riderVisible = !!order.deliveryPartner && order.status !== 'cancelled';
  const canTrack =
    order.status === 'assigned' || order.status === 'out_for_delivery';

  return (
    <View style={styles.fill}>
      <StatusBar style="dark" />
      <ScreenHeader
        title={`#${order.orderNumber}`}
        subtitle={formatDate(order.createdAt)}
        onBack={() => router.back()}
        right={
          <IconButton
            icon="copy-outline"
            onPress={copyNumber}
            accessibilityLabel="Copy order number"
            size={38}
          />
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      >
        <Card style={[styles.statusCard, { backgroundColor: meta.background, borderColor: meta.background }]}>
          <View style={styles.statusTop}>
            <View style={styles.statusTitle}>
              <View style={[styles.statusIcon, { backgroundColor: colors.white }]}>
                <Ionicons name={meta.icon as never} size={23} color={meta.text} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="section" style={{ color: meta.text }}>
                  {meta.label}
                </AppText>
                <AppText variant="meta" style={{ color: meta.text, opacity: 0.78 }}>
                  {statusCopy(order)}
                </AppText>
              </View>
            </View>
          </View>
          {order.status !== 'cancelled' ? (
            <View style={styles.statusProgressWrap}>
              <StatusProgress status={order.status} />
              <View style={styles.progressLabels}>
                <AppText variant="caption" style={{ color: meta.text, opacity: 0.72 }}>
                  Order placed
                </AppText>
                <AppText variant="caption" style={{ color: meta.text, opacity: 0.72 }}>
                  Delivered
                </AppText>
              </View>
            </View>
          ) : null}
          {order.status === 'delivered' && order.deliveredAt ? (
            <View style={styles.deliveredAt}>
              <Ionicons name="checkmark-circle" size={15} color={colors.primaryDark} />
              <AppText variant="caption" style={{ color: colors.primaryDark }}>
                Delivered on {formatDate(order.deliveredAt)}
              </AppText>
            </View>
          ) : null}
          {order.status === 'cancelled' && order.cancelReason ? (
            <AppText variant="meta" style={{ color: colors.danger }}>
              {order.cancelReason}
            </AppText>
          ) : null}
        </Card>

        {riderVisible ? (
          <Card style={styles.riderCard}>
            <View style={styles.riderTop}>
              <View style={styles.avatar}>
                <AppText variant="bodyMedium" tone="primary" style={{ fontWeight: '800' }}>
                  {initials(order.deliveryPartner?.name, order.deliveryPartner?.email)}
                </AppText>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
                  {order.deliveryPartner?.name || 'Your delivery partner'}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {canTrack
                    ? 'Bringing your order to your door'
                    : 'Delivered your LocalMart order'}
                </AppText>
                {order.accepted && canTrack ? (
                  <Badge label="Assignment accepted" tone="green" icon="checkmark" />
                ) : null}
              </View>
              <IconButton
                icon="call-outline"
                onPress={callRider}
                accessibilityLabel="Call delivery partner"
                size={40}
                color={colors.primaryDark}
                backgroundColor={colors.primarySoft}
                border={false}
              />
            </View>
            {canTrack ? (
              <Button
                label="Track live order"
                onPress={() => router.push(`/tracking/${order.id}`)}
                icon="navigate-outline"
                variant="secondary"
                size="sm"
              />
            ) : null}
          </Card>
        ) : null}

        {canTrack ? (
          <Card style={styles.trackingPrompt}>
            <View style={styles.trackingIcon}>
              <Ionicons name="navigate" size={20} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
                Follow your rider in real time
              </AppText>
              <AppText variant="caption" tone="muted">
                See the latest location and delivery updates.
              </AppText>
            </View>
            <Pressable
              onPress={() => router.push(`/tracking/${order.id}`)}
              accessibilityRole="button"
              accessibilityLabel="Open live tracking"
              hitSlop={8}
            >
              <Ionicons name="chevron-forward" size={19} color={colors.primaryDark} />
            </Pressable>
          </Card>
        ) : null}

        <Card style={styles.sectionCard}>
          <View style={styles.cardHeading}>
            <AppText variant="section">Your order</AppText>
            <AppText variant="caption" tone="muted">
              {order.itemCount} {pluralize(order.itemCount, 'item')}
            </AppText>
          </View>
          {order.items.map((item, index) => (
            <View
              key={item.id}
              style={[styles.itemRow, index < order.items.length - 1 && styles.itemBorder]}
            >
              <View style={styles.itemImageWrap}>
                {item.product.imageUrl ? (
                  <Image
                    source={{ uri: item.product.imageUrl }}
                    style={styles.itemImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Ionicons name="leaf-outline" size={21} color={colors.primary} />
                )}
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <AppText variant="bodyMedium" style={{ fontWeight: '600' }} numberOfLines={1}>
                  {item.product.name}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {money(item.unitPrice)} × {item.quantity} · {item.product.unit}
                </AppText>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <AppText variant="bodyMedium" style={{ fontWeight: '600' }}>
                  {money(item.total)}
                </AppText>
                {order.status === 'delivered' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Rate ${item.product.name}`}
                    onPress={() => {
                      setReviewTarget({
                        productId: item.productId,
                        name: item.product.name,
                      });
                      setReviewRating(5);
                      setReviewComment(
                        (reviewedDrafts[item.productId] as string | undefined) ?? '',
                      );
                    }}
                    hitSlop={6}
                    style={({ pressed }) => [styles.rateButton, pressed && { opacity: 0.8 }]}
                  >
                    <Ionicons
                      name={reviewedProductIds.includes(item.productId) ? 'star' : 'star-outline'}
                      size={12}
                      color="#F59E0B"
                    />
                    <AppText style={styles.rateText}>
                      {reviewedProductIds.includes(item.productId) ? 'Rated' : 'Rate'}
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </Card>

        <Card style={styles.sectionCard}>
          <AppText variant="section">Delivery address</AppText>
          <View style={styles.addressRow}>
            <View style={styles.addressIcon}>
              <Ionicons name="location-outline" size={20} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.addressLabel}>
                <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
                  {order.address.label}
                </AppText>
              </View>
              <AppText variant="meta" tone="muted">
                {formatAddress(order.address)}
              </AppText>
            </View>
          </View>
          {order.notes ? (
            <View style={styles.notesBox}>
              <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.muted} />
              <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
                “{order.notes}”
              </AppText>
            </View>
          ) : null}
        </Card>

        <Card style={styles.sectionCard}>
          <AppText variant="section">Payment</AppText>
          <View style={styles.paymentRow}>
            <View style={styles.paymentIcon}>
              <Ionicons name="cash-outline" size={20} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <AppText variant="bodyMedium" style={{ fontWeight: '600' }}>
                {PAYMENT_METHOD_LABEL[order.paymentMethod]}
              </AppText>
              <AppText variant="caption" tone="muted">
                {PAYMENT_STATUS_LABEL[order.paymentStatus]}
              </AppText>
            </View>
            <StatusPill status={order.status} compact />
          </View>
          <BillSummary order={order} />
        </Card>

        <Card style={styles.sectionCard}>
          <AppText variant="section">Order journey</AppText>
          <StatusTimeline status={order.status} history={order.statusHistory} />
        </Card>

        <Card style={styles.helpCard}>
          <View style={styles.helpIcon}>
            <Ionicons name="headset-outline" size={20} color={colors.primaryDark} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
              Need a hand?
            </AppText>
            <AppText variant="caption" tone="muted">
              We’re here for missing items, delays, or anything else.
            </AppText>
          </View>
          <Pressable onPress={contactSupport} hitSlop={8}>
            <AppText variant="meta" tone="primary" style={{ fontWeight: '700' }}>
              Contact
            </AppText>
          </Pressable>
        </Card>

        {canCancel ? (
          <Button
            label="Cancel order"
            onPress={() => {
              setCancelReason('');
              setCancelError(null);
              setCancelOpen(true);
            }}
            variant="ghost"
            icon="close-circle-outline"
            style={styles.cancelButton}
          />
        ) : null}

        <AppText variant="caption" tone="subtle" style={styles.footer}>
          {SUPPORT_PHONE.replace(/(\+91)(\d{2})(\d{4})(\d{4})/, '$1 $2 $3 $4')} · {SUPPORT_EMAIL}
        </AppText>
      </ScrollView>

      <ModalSheet
        visible={cancelOpen}
        onClose={() => {
          if (!cancelling) setCancelOpen(false);
        }}
        title="Cancel this order?"
        subtitle="This can’t be undone. Any reserved items will be returned to stock."
      >
        <TextField
          label="Reason for cancelling"
          required
          placeholder="e.g. Ordered by mistake"
          value={cancelReason}
          onChangeText={setCancelReason}
          multiline
          maxLength={300}
          error={cancelError}
          editable={!cancelling}
        />
        <View style={styles.sheetActions}>
          <Button
            label="Keep order"
            onPress={() => setCancelOpen(false)}
            variant="secondary"
            disabled={cancelling}
            style={{ flex: 1 }}
          />
          <Button
            label="Cancel order"
            onPress={cancelOrder}
            variant="danger"
            loading={cancelling}
            style={{ flex: 1 }}
          />
        </View>
      </ModalSheet>

      <ModalSheet
        visible={reviewTarget !== null}
        onClose={() => {
          if (!reviewSubmitting) setReviewTarget(null);
        }}
        title={`Rate ${reviewTarget?.name ?? 'item'}`}
        subtitle="How fresh was it? The store reads every review."
      >
        <View style={styles.starPicker}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              accessibilityRole="button"
              accessibilityLabel={`${star} star${star === 1 ? '' : 's'}`}
              onPress={() => setReviewRating(star)}
              hitSlop={8}
              disabled={reviewSubmitting}
            >
              <Ionicons
                name={star <= reviewRating ? 'star' : 'star-outline'}
                size={34}
                color={star <= reviewRating ? '#F59E0B' : colors.subtle}
              />
            </Pressable>
          ))}
        </View>
        <TextField
          label="Comment (optional)"
          placeholder="Fresh, well packed, right on time…"
          value={reviewComment}
          onChangeText={setReviewedTextFor}
          multiline
          maxLength={500}
          editable={!reviewSubmitting}
        />
        <Button
          label={reviewTarget && reviewedProductIds.includes(reviewTarget.productId) ? 'Update review' : 'Submit review'}
          onPress={() => void submitReview()}
          loading={reviewSubmitting}
        />
      </ModalSheet>
    </View>
  );
}

function statusCopy(order: Order): string {
  switch (order.status) {
    case 'pending':
      return 'The store has received your order and will confirm it shortly.';
    case 'confirmed':
      return 'Confirmed! The store is getting your items together.';
    case 'preparing':
      return 'Your items are being carefully packed right now.';
    case 'assigned':
      return order.accepted
        ? 'Your rider has accepted the order and is heading to the store.'
        : 'A rider is being assigned to your order.';
    case 'out_for_delivery':
      return 'Your order is on its way. Keep your phone nearby.';
    case 'delivered':
      return 'Delivered fresh to your door. We hope you enjoy it!';
    case 'cancelled':
      return 'This order was cancelled.';
    default:
      return '';
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  content: { padding: 20, gap: 14, paddingBottom: 30 },
  statusCard: { gap: 14, borderWidth: 1 },
  statusTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusTitle: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  statusIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusProgressWrap: { gap: 7 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  deliveredAt: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  riderCard: { gap: 13 },
  riderTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingPrompt: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  trackingIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: { gap: 13 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rateText: { fontSize: 10.5, fontWeight: '800', color: '#B45309', lineHeight: 14 },
  starPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  itemImageWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImage: { width: '100%', height: '100%' },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: 10,
  },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  helpIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: { marginTop: 2 },
  footer: { textAlign: 'center', marginTop: 2 },
  sheetActions: { flexDirection: 'row', gap: 10 },
});
