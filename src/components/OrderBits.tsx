import { colors, radius, themedStyles } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { ORDER_FLOW, STATUS_META, formatDate, money, statusProgress } from '@/lib/format';
import type { Order, OrderStatus, OrderStatusHistory } from '@/lib/types';
import { AppText } from './ui/AppText';

export function StatusPill({
  status,
  compact = false,
}: {
  status: OrderStatus;
  compact?: boolean;
}) {
  const meta = STATUS_META[status];
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: meta.background },
        compact && styles.pillCompact,
      ]}
    >
      <Ionicons name={meta.icon as never} size={compact ? 11 : 13} color={meta.text} />
      <AppText
        variant="caption"
        style={{ color: meta.text, fontWeight: '700', fontSize: compact ? 10 : 11 }}
      >
        {meta.label}
      </AppText>
    </View>
  );
}

export function StatusProgress({ status }: { status: OrderStatus }) {
  const progress = statusProgress(status);
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${Math.round(progress * 100)}%`,
            backgroundColor: status === 'cancelled' ? colors.danger : colors.primary,
          },
        ]}
      />
    </View>
  );
}

type TimelineProps = {
  status: OrderStatus;
  history: OrderStatusHistory[];
};

export function StatusTimeline({ status, history }: TimelineProps) {
  if (status === 'cancelled') {
    const entry = history.find((item) => item.status === 'cancelled');
    return (
      <View style={styles.cancelled}>
        <View style={styles.cancelledIcon}>
          <Ionicons name="close-circle" size={24} color={colors.danger} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyMedium" style={{ color: colors.danger, fontWeight: '700' }}>
            Order cancelled
          </AppText>
          <AppText variant="meta" tone="muted">
            {entry?.note || 'This order was cancelled.'}
          </AppText>
        </View>
      </View>
    );
  }

  const currentIndex = ORDER_FLOW.indexOf(status);
  return (
    <View style={styles.timeline}>
      {ORDER_FLOW.map((step, index) => {
        const entry = history.find((item) => item.status === step);
        const complete = index < currentIndex || status === 'delivered';
        const current = index === currentIndex && status !== 'delivered';
        const active = complete || current;
        return (
          <View key={step} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View
                style={[
                  styles.dot,
                  active && styles.dotActive,
                  current && styles.dotCurrent,
                ]}
              >
                {complete ? (
                  <Ionicons name="checkmark" size={11} color={colors.white} />
                ) : current ? (
                  <View style={styles.dotInner} />
                ) : null}
              </View>
              {index < ORDER_FLOW.length - 1 ? (
                <View style={[styles.line, active && styles.lineActive]} />
              ) : null}
            </View>
            <View style={styles.timelineText}>
              <AppText
                variant="bodyMedium"
                style={{
                  color: active ? colors.text : colors.subtle,
                  fontWeight: current ? '700' : '500',
                }}
              >
                {STATUS_META[step].label}
              </AppText>
              {entry ? (
                <AppText variant="caption" tone="subtle">
                  {formatDate(entry.createdAt)}
                </AppText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function FreeDeliveryProgress({
  subtotal,
  threshold,
  fee,
}: {
  subtotal: number;
  threshold: number;
  fee: number;
}) {
  const remaining = Math.max(0, threshold - subtotal);
  const unlocked = remaining <= 0;
  const percent = Math.min(100, Math.round((subtotal / Math.max(threshold, 1)) * 100));
  return (
    <View style={[styles.deliveryCard, unlocked && styles.deliveryCardUnlocked]}>
      <View style={styles.deliveryTop}>
        <View style={styles.deliveryTitle}>
          <Ionicons
            name={unlocked ? 'checkmark-circle' : 'bicycle'}
            size={19}
            color={unlocked ? colors.primaryDark : colors.primary}
          />
          <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
            {unlocked
              ? 'Free delivery unlocked'
              : `Add ${money(remaining)} more for free delivery`}
          </AppText>
        </View>
        <AppText variant="caption" tone={unlocked ? 'primary' : 'muted'}>
          {unlocked ? `You saved ${money(fee)}` : `${percent}%`}
        </AppText>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

export function BillSummary({
  order,
  platformFee = 0,
}: {
  order: Pick<Order, 'subtotal' | 'deliveryFee' | 'discount' | 'total'>;
  platformFee?: number;
}) {
  return (
    <View style={styles.bill}>
      <BillRow label="Subtotal" value={money(order.subtotal)} />
      <BillRow
        label="Delivery fee"
        value={Number(order.deliveryFee) === 0 ? 'Free' : money(order.deliveryFee)}
        highlight={Number(order.deliveryFee) === 0}
      />
      <BillRow label="Platform fee" value={platformFee === 0 ? 'Free' : money(platformFee)} />
      {Number(order.discount) > 0 ? (
        <BillRow label="Discount" value={`−${money(order.discount)}`} highlight />
      ) : null}
      <View style={styles.divider} />
      <View style={styles.totalRow}>
        <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
          Total
        </AppText>
        <AppText variant="price">{money(order.total)}</AppText>
      </View>
    </View>
  );
}

function BillRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.billRow}>
      <AppText variant="body" tone="muted">
        {label}
      </AppText>
      <AppText
        variant="bodyMedium"
        style={{ color: highlight ? colors.primaryDark : colors.text }}
      >
        {value}
      </AppText>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = themedStyles((colors) => StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillCompact: { paddingHorizontal: 7, paddingVertical: 4 },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineRail: { width: 22, alignItems: 'center' },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  dotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotCurrent: { borderColor: colors.primaryDark, backgroundColor: colors.primary },
  dotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white },
  line: { width: 2, flex: 1, minHeight: 22, backgroundColor: colors.borderStrong },
  lineActive: { backgroundColor: colors.primary },
  timelineText: { flex: 1, paddingBottom: 18, gap: 1 },
  cancelled: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.dangerSoft,
  },
  cancelledIcon: { paddingTop: 1 },
  deliveryCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  deliveryCardUnlocked: { borderColor: '#BBF7D0' },
  deliveryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  deliveryTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  bill: { gap: 9 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 3 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
}));
