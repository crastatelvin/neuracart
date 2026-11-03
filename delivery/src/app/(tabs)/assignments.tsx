import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { ConfirmAction } from '@/components/ConfirmAction';
import { colors, themedStyles } from '@/constants/design';
import { apiErrorMessage, apiRequest, isApiError } from '@/lib/api';
import { RIDER_PAYOUT } from '@/lib/config';
import {
  firstName,
  money,
  pluralize,
  relativeTime,
} from '@/lib/format';
import type { Order } from '@/lib/types';
import { useDeliveryStore } from '@/store/delivery';
import { useToastStore } from '@/store/toast';

type PendingAction =
  | { kind: 'decline'; order: Order }
  | { kind: 'start'; order: Order }
  | { kind: 'complete'; order: Order }
  | null;

export default function AssignmentsScreen() {
  const router = useRouter();
  const toast = useToastStore((state) => state.show);

  const profile = useDeliveryStore((state) => state.profile);
  const assignments = useDeliveryStore((state) => state.assignments);
  const storeError = useDeliveryStore((state) => state.error);
  const busy = useDeliveryStore((state) => state.busy);
  const fetchAssignments = useDeliveryStore((state) => state.fetchAssignments);
  const setAvailability = useDeliveryStore((state) => state.setAvailability);
  const accept = useDeliveryStore((state) => state.accept);
  const reject = useDeliveryStore((state) => state.reject);
  const start = useDeliveryStore((state) => state.start);
  const complete = useDeliveryStore((state) => state.complete);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [weather, setWeather] = useState<{
    mode: 'NORMAL' | 'RAIN' | 'HEAVY';
    note: string;
    surgeFee: string;
    etaMinutes: number;
  } | null>(null);

  useEffect(() => {
    void fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    void apiRequest<{ mode: 'NORMAL' | 'RAIN' | 'HEAVY'; note: string; surgeFee: string; etaMinutes: number }>(
      '/delivery/weather',
    )
      .then(setWeather)
      .catch(() => setWeather(null));
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAssignments();
    setRefreshing(false);
  }, [fetchAssignments]);

  const toggleAvailability = async (value: boolean) => {
    try {
      await setAvailability(value);
      toast(value ? 'You are online.' : 'You are offline.');
    } catch (caught) {
      toast(apiErrorMessage(caught));
    }
  };

  const runAction = async () => {
    if (!pending) return;
    const { order, kind } = pending;
    setPending(null);
    try {
      if (kind === 'decline') {
        await reject(order.id);
        toast(`${order.orderNumber} declined. The store will reassign it.`);
      } else if (kind === 'start') {
        await start(order.id);
        toast(`Delivery started for ${order.orderNumber}.`);
      } else {
        await complete(order.id);
        toast(`${order.orderNumber} delivered · ₹${RIDER_PAYOUT} earned.`);
      }
    } catch (caught) {
      toast(apiErrorMessage(caught));
    } finally {
      void fetchAssignments();
    }
  };

  const acceptOrder = async (order: Order) => {
    try {
      await accept(order.id);
      toast(`${order.orderNumber} accepted. Head to the store.`);
    } catch (caught) {
      if (isApiError(caught) && caught.status === 409) {
        void fetchAssignments();
      }
      toast(apiErrorMessage(caught));
    } finally {
      void fetchAssignments();
    }
  };

  const isBusy = (key: string, id: string) => busy === `${key}:${id}`;
  const firstNameFallback = firstName(profile?.name);
  const activeCount = assignments?.counts.current ?? 0;
  const offline = profile ? !profile.isAvailable : true;
  const hasAnything = assignments
    ? assignments.new.length + assignments.ready.length + assignments.active.length + assignments.completed.length > 0
    : false;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.white} />}
    >
      <LinearGradient
        colors={['#14532D', '#15803D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <AppText variant="title" tone="white">
              Hello, {firstNameFallback}
            </AppText>
            <AppText variant="meta" tone="white" style={styles.headerHint}>
              {activeCount === 0
                ? 'No active assignments'
                : `${activeCount} active ${pluralize(activeCount, 'assignment')}`}
            </AppText>
          </View>
          <View style={styles.switchWrap}>
            <AppText variant="caption" tone="white">
              {offline ? 'Offline' : 'Online'}
            </AppText>
            <Switch
              accessibilityLabel="Availability switch"
              value={!offline}
              onValueChange={(value) => void toggleAvailability(value)}
              trackColor={{ false: 'rgba(255,255,255,0.3)', true: '#4ADE80' }}
              thumbColor={colors.white}
              ios_backgroundColor="rgba(255,255,255,0.3)"
            />
          </View>
        </View>
      </LinearGradient>

      {weather && weather.mode !== 'NORMAL' ? (
        <View style={styles.weatherBanner}>
          <Ionicons name="rainy-outline" size={18} color="#92400E" />
          <View style={{ flex: 1 }}>
            <AppText variant="meta" style={{ fontWeight: '700', color: '#92400E' }}>
              {weather.note || (weather.mode === 'HEAVY' ? 'Heavy weather' : 'Rain')}
            </AppText>
            <AppText variant="caption" style={{ color: '#92400E' }}>
              Surge {money(Number(weather.surgeFee))} · allow ~{weather.etaMinutes} min per delivery
            </AppText>
          </View>
        </View>
      ) : null}

      {offline ? (
        <Card style={[styles.banner, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
          <Ionicons name="cloud-offline-outline" size={16} color="#B45309" />
          <AppText variant="bodyMedium" style={styles.bannerText}>
            You’re offline. Go online to receive new assignments.
          </AppText>
        </Card>
      ) : null}

      {storeError ? (
        <Card style={[styles.banner, { backgroundColor: colors.dangerSoft, borderColor: '#FECACA' }]} padded={false}>
          <View style={styles.errorRow}>
            <AppText variant="bodyMedium" tone="danger" style={styles.bannerText}>
              {storeError}
            </AppText>
            <Button
              label="Retry"
              size="sm"
              variant="secondary"
              fullWidth={false}
              onPress={() => void refresh()}
            />
          </View>
        </Card>
      ) : null}

      {!assignments && !storeError ? (
        <Card style={styles.loadingCard}>
          <AppText variant="body" tone="muted">
            Loading assignments…
          </AppText>
        </Card>
      ) : null}

      {assignments && !hasAnything ? (
        <Card style={styles.emptyCard}>
          <EmptyState
            icon="bicycle-outline"
            title="No assignments right now"
            description={
              offline
                ? 'Go online and we’ll notify you when the store has a delivery for you.'
                : 'Stay online and we’ll notify you the moment the store assigns a delivery.'
            }
            actionLabel={offline ? undefined : 'Refresh'}
            onAction={offline ? undefined : () => void refresh()}
          />
        </Card>
      ) : null}

      {assignments && assignments.new.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader label="New assignments" count={assignments.new.length} icon="flash-outline" />
          {assignments.new.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onOpen={() => router.push(`/order/${order.id}`)}
              actions={
                <View style={styles.actionRow}>
                  <Button
                    label="Decline"
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    disabled={!!busy}
                    onPress={() => setPending({ kind: 'decline', order })}
                  />
                  <Button
                    label="Accept"
                    size="sm"
                    fullWidth={false}
                    loading={isBusy('accept', order.id)}
                    disabled={!!busy}
                    onPress={() => void acceptOrder(order)}
                  />
                </View>
              }
            />
          ))}
        </View>
      ) : null}

      {assignments && assignments.ready.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader label="Ready to start" count={assignments.ready.length} icon="bag-check-outline" />
          {assignments.ready.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              accepted
              onOpen={() => router.push(`/order/${order.id}`)}
              actions={
                <Button
                  label="Start delivery"
                  size="sm"
                  fullWidth={false}
                  loading={isBusy('start', order.id)}
                  disabled={!!busy}
                  onPress={() => setPending({ kind: 'start', order })}
                />
              }
            />
          ))}
        </View>
      ) : null}

      {assignments && assignments.active.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader label="Active" count={assignments.active.length} icon="navigate-outline" />
          {assignments.active.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              accepted
              active
              onOpen={() => router.push(`/order/${order.id}`)}
              actions={
                <Button
                  label="Complete delivery"
                  size="sm"
                  fullWidth={false}
                  disabled={!!busy}
                  onPress={() => router.push(`/order/${order.id}`)}
                />
              }
            />
          ))}
        </View>
      ) : null}

      {assignments && assignments.completed.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader label="Completed today" count={assignments.completed.length} icon="checkmark-done-outline" />
          {assignments.completed.map((order) => (
            <Card key={order.id} style={styles.doneRow}>
              <View style={styles.doneMain}>
                <AppText variant="card">{order.orderNumber}</AppText>
                <AppText variant="caption" tone="muted">
                  {order.customer.name ?? 'Customer'} · {order.address.city}
                </AppText>
              </View>
              <View style={styles.doneRight}>
                <Badge label="Delivered" tone="green" />
                <AppText variant="meta" tone="muted">
                  {relativeTime(order.deliveredAt ?? order.updatedAt)}
                </AppText>
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <AppText variant="caption" tone="subtle" style={styles.footnote}>
        You earn ₹{RIDER_PAYOUT} for every delivered order.
      </AppText>

      <ConfirmAction
        open={!!pending}
        title={
          pending?.kind === 'decline'
            ? `Decline ${pending?.order.orderNumber}?`
            : pending?.kind === 'start'
              ? `Start delivery for ${pending?.order.orderNumber}?`
              : `Deliver ${pending?.order.orderNumber}?`
        }
        description={
          pending?.kind === 'decline'
            ? 'The order returns to the store and gets reassigned to another rider.'
            : pending?.kind === 'start'
              ? 'Mark this order as out for delivery? The customer is notified by email.'
              : 'Confirm the order has been handed to the customer? This cannot be undone.'
        }
        confirmLabel={
          pending?.kind === 'decline'
            ? 'Decline'
            : pending?.kind === 'start'
              ? 'Start delivery'
              : 'Mark delivered'
        }
        tone={pending?.kind === 'decline' ? 'danger' : 'primary'}
        busy={!!pending && !!busy}
        onConfirm={() => void runAction()}
        onClose={() => setPending(null)}
      />
    </ScrollView>
  );
}

function SectionHeader({ label, count, icon }: { label: string; count: number; icon: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as never} size={15} color={colors.primaryDark} />
      <AppText variant="meta" tone="primary" style={styles.sectionTitle}>
        {label}
      </AppText>
      <AppText variant="caption" tone="muted">
        {count}
      </AppText>
    </View>
  );
}

function OrderCard({
  order,
  accepted = false,
  active = false,
  onOpen,
  actions,
}: {
  order: Order;
  accepted?: boolean;
  active?: boolean;
  onOpen: () => void;
  actions: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open assignment ${order.orderNumber}`}
      onPress={onOpen}
    >
      <Card style={styles.orderCard}>
        <View style={styles.orderTop}>
          <View style={{ flex: 1 }}>
            <AppText variant="card">{order.orderNumber}</AppText>
            <AppText variant="caption" tone="muted">
              {order.itemCount} {pluralize(order.itemCount, 'item')} · {order.address.city} · COD cash ₹{Number(order.total).toFixed(0)}
            </AppText>
          </View>
          <Badge
            label={active ? 'On the way' : accepted ? 'Accepted' : 'Waiting'}
            tone={active ? 'blue' : accepted ? 'green' : 'amber'}
          />
        </View>
        <View style={styles.orderMeta}>
          <AppText variant="meta" tone="muted">
            {order.customer.name ?? 'Customer'} · {order.address.line2 ?? order.address.line1}
          </AppText>
          <AppText variant="meta" tone="subtle">
            Payout {money(order.payout ?? RIDER_PAYOUT)}
          </AppText>
        </View>
        {actions}
      </Card>
    </Pressable>
  );
}

const styles = themedStyles((colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 32 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 62,
    paddingBottom: 18,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerCopy: { flex: 1 },
  weatherBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
  },
  headerHint: { opacity: 0.85, marginTop: 3 },
  switchWrap: { alignItems: 'center', gap: 2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 14,
  },
  bannerText: { flex: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  loadingCard: { marginHorizontal: 20, marginTop: 14 },
  emptyCard: { marginHorizontal: 20, marginTop: 18 },
  section: { marginTop: 22, paddingHorizontal: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: { color: colors.primaryDark, flex: 1 },
  orderCard: { gap: 10 },
  orderTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  orderMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  doneMain: { flex: 1 },
  doneRight: { alignItems: 'flex-end', gap: 2 },
  footnote: { textAlign: 'center', marginTop: 24 },
}));
