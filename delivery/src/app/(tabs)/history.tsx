import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { colors, radius, themedStyles } from '@/constants/design';
import { RIDER_PAYOUT } from '@/lib/config';
import { formatDate, money } from '@/lib/format';
import type { EarningsPeriod } from '@/lib/types';
import { useDeliveryStore } from '@/store/delivery';

const PERIODS: { value: EarningsPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
];

type EarningsListEntry = {
  id: string;
  orderNumber: string;
  deliveredAt: string | null;
  payout: string;
  customerArea: string;
};

type Group = { date: string; entries: EarningsListEntry[] };

export default function HistoryScreen() {
  const earnings = useDeliveryStore((state) => state.earnings);
  const period = useDeliveryStore((state) => state.earningPeriod);
  const error = useDeliveryStore((state) => state.earningsError);
  const fetchEarnings = useDeliveryStore((state) => state.fetchEarnings);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEarnings(useDeliveryStore.getState().earningPeriod);
    setRefreshing(false);
  }, [fetchEarnings]);

  useEffect(() => {
    const chosen = period;
    if (!earnings || earnings.period !== chosen) {
      void fetchEarnings(chosen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const changePeriod = async (next: EarningsPeriod) => {
    await fetchEarnings(next);
  };

  const groups: Group[] = (() => {
    if (!earnings) return [];
    const buckets = new Map<string, EarningsListEntry[]>();
    for (const entry of earnings.history) {
      const key = (entry.deliveredAt ?? '').slice(0, 10) || '—';
      const list = buckets.get(key) ?? [];
      list.push(entry);
      buckets.set(key, list);
    }
    return Array.from(buckets.keys())
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => ({ date, entries: buckets.get(date)! }));
  })();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          tintColor={colors.white}
        />
      }
    >
      <LinearGradient
        colors={['#14532D', '#15803D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <AppText variant="meta" tone="white" style={styles.headerHint}>
          Earnings summary
        </AppText>
        <View style={styles.heroRow}>
          <View>
            <AppText variant="caption" tone="white" style={styles.heroLabel}>
              {PERIODS.find((item) => item.value === period)?.label}
            </AppText>
            <AppText variant="display" tone="white">
              {money(earnings?.total ?? 0)}
            </AppText>
          </View>
          <View style={styles.heroRight}>
            <AppText variant="caption" tone="white" style={styles.heroLabel}>
              Deliveries
            </AppText>
            <AppText variant="title" tone="white">
              {earnings ? earnings.deliveries : '—'}
            </AppText>
            <AppText variant="caption" tone="white" style={styles.heroLabel}>
              Avg. {money(earnings?.average ?? 0)}
            </AppText>
          </View>
        </View>
        <View style={styles.lifetimeRow}>
          <AppText variant="caption" tone="white">
            Lifetime: {money(earnings?.lifetime.earnings ?? 0)} ·{' '}
            {earnings?.lifetime.deliveries ?? 0} deliveries
          </AppText>
        </View>
      </LinearGradient>

      <View style={styles.chipsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {PERIODS.map((item) => (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              accessibilityLabel={`Show ${item.label} earnings`}
              onPress={() => void changePeriod(item.value)}
              style={[
                styles.chip,
                styles.chipBase,
                item.value === period ? styles.chipActive : null,
              ]}
            >
              <AppText
                variant="meta"
                style={{ color: item.value === period ? colors.white : colors.muted, fontWeight: '600' }}
              >
                {item.label}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <AppText variant="bodyMedium" tone="danger">
            {error}
          </AppText>
        </Card>
      ) : null}

      {!earnings && !error ? (
        <Card style={styles.loadingCard}>
          <AppText variant="body" tone="muted">
            Loading earnings…
          </AppText>
        </Card>
      ) : null}

      {earnings && earnings.history.length === 0 ? (
        <Card style={styles.emptyCard}>
          <EmptyState
            icon="receipt-outline"
            title="No completed deliveries yet"
            description={
              period === 'all'
                ? `Your first completed delivery will show up here with its ₹${RIDER_PAYOUT} payout.`
                : 'Switch to “All time” to see your full delivery record.'
            }
          />
        </Card>
      ) : null}

      {groups.map((group) => (
        <View key={group.date} style={styles.group}>
          <AppText variant="meta" tone="muted" style={styles.groupTitle}>
            {group.date === '—' ? 'Unknown date' : formatDate(group.date)}
          </AppText>
          {group.entries.map((entry) => (
            <Card key={entry.id} style={styles.row}>
              <View style={styles.rowMain}>
                <AppText variant="card">{entry.orderNumber}</AppText>
                <AppText variant="caption" tone="muted">
                  {entry.customerArea || 'Customer'}
                </AppText>
              </View>
              <View style={styles.rowRight}>
                <Badge label={money(entry.payout)} tone="green" />
              </View>
            </Card>
          ))}
        </View>
      ))}

      <AppText variant="caption" tone="subtle" style={styles.footnote}>
        Payouts settle at ₹{RIDER_PAYOUT} per delivered order, credited to your ledger.
      </AppText>
    </ScrollView>
  );
}

const styles = themedStyles((colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 32 },
  header: { paddingHorizontal: 20, paddingTop: 62, paddingBottom: 20 },
  headerHint: { opacity: 0.8, marginBottom: 2 },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  heroLabel: { opacity: 0.85, marginBottom: 2 },
  heroRight: { alignItems: 'flex-end', gap: 2 },
  lifetimeRow: { marginTop: 10, opacity: 0.9 },
  chipsRow: { marginTop: 16, paddingHorizontal: 20 },
  chips: { flexDirection: 'row', gap: 8 },
  chipBase: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
  },
  chip: { paddingVertical: 8, paddingHorizontal: 16 },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  errorCard: { marginHorizontal: 20, marginTop: 16 },
  loadingCard: { marginHorizontal: 20, marginTop: 16 },
  emptyCard: { marginHorizontal: 20, marginTop: 16 },
  group: { paddingHorizontal: 20, marginTop: 20 },
  groupTitle: { marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  rowMain: { flex: 1, gap: 2 },
  rowRight: {},
  footnote: { textAlign: 'center', marginTop: 22 },
}));
