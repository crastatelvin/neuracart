import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { colors, radius } from '@/constants/design';
import { apiRequest } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ProductReviewFeed } from '@/lib/types';

function Stars({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <View style={styles.starsRow} accessibilityLabel={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= Math.round(value) ? 'star' : 'star-outline'}
          size={size}
          color={star <= Math.round(value) ? '#F59E0B' : colors.subtle}
        />
      ))}
    </View>
  );
}

export function ProductReviews({ productId }: { productId: string }) {
  const [feed, setFeed] = useState<ProductReviewFeed | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void apiRequest<ProductReviewFeed>(`/reviews/product/${productId}`, { auth: false })
        .then((result) => {
          if (!cancelled) setFeed(result);
        })
        .catch(() => {
          // Reviews are a nice-to-have; the page stays fully usable without them.
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [productId]);

  if (!feed || feed.summary.count === 0) return null;

  return (
    <View style={styles.block}>
      <View style={styles.headingRow}>
        <AppText variant="section">Customer reviews</AppText>
        <View style={styles.summary}>
          <Stars value={feed.summary.average ?? 0} />
          <AppText variant="caption" tone="muted">
            {feed.summary.average?.toFixed(1)} · {feed.summary.count}{' '}
            {feed.summary.count === 1 ? 'review' : 'reviews'}
          </AppText>
        </View>
      </View>
      {feed.reviews.slice(0, 5).map((review) => (
        <View key={review.id} style={styles.review}>
          <View style={styles.reviewHead}>
            <Stars value={review.rating} size={11} />
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {review.author}
              {review.isVerified ? ' · verified purchase' : ''}
            </AppText>
          </View>
          {review.comment ? (
            <AppText variant="body" tone="muted">
              {review.comment}
            </AppText>
          ) : null}
          {review.response ? (
            <View style={styles.storeReply}>
              <AppText variant="caption" style={styles.storeReplyLabel}>
                Response from the store
              </AppText>
              <AppText variant="caption" tone="muted">
                {review.response}
              </AppText>
            </View>
          ) : null}
          <AppText variant="meta" tone="subtle">
            {formatDate(review.createdAt)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 12,
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  starsRow: { flexDirection: 'row', gap: 2 },
  review: { gap: 5, paddingLeft: 2 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  storeReply: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: 9,
    gap: 2,
  },
  storeReplyLabel: { color: colors.primaryDark, fontWeight: '700' },
});
