import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Badge, IconButton } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/Header';
import { ErrorState } from '@/components/ui/States';
import { StatusPill, StatusTimeline } from '@/components/OrderBits';
import { colors, radius, shadows } from '@/constants/design';
import { apiErrorMessage, apiRequest } from '@/lib/api';
import { STATUS_META, formatAddress, formatDate, initials, isActiveOrder, relativeTime } from '@/lib/format';
import type { Order } from '@/lib/types';
import { useToastStore } from '@/store/toast';

type Point = { latitude: number; longitude: number };
type PlacedPoint = Point & { x: number; y: number };

export default function TrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const orderId = String(params.id ?? '');
  const showToast = useToastStore((state) => state.show);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const timer = setInterval(() => void load(true), 15_000);
    return () => clearInterval(timer);
  }, [load, order]);

  async function refresh() {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }

  const map = useMemo(() => {
    if (!order) return null;
    const tracking = order.tracking;
    const store: Point = {
      latitude: tracking?.storeLatitude ?? 12.9716,
      longitude: tracking?.storeLongitude ?? 77.5946,
    };
    const home: Point = {
      latitude: tracking?.customerLatitude ?? store.latitude + 0.012,
      longitude: tracking?.customerLongitude ?? store.longitude + 0.016,
    };
    const rider: Point | null =
      tracking?.latitude != null && tracking?.longitude != null
        ? { latitude: tracking.latitude, longitude: tracking.longitude }
        : null;
    const points = rider ? [store, home, rider] : [store, home];
    const minLat = Math.min(...points.map((point) => point.latitude));
    const maxLat = Math.max(...points.map((point) => point.latitude));
    const minLng = Math.min(...points.map((point) => point.longitude));
    const maxLng = Math.max(...points.map((point) => point.longitude));
    const latSpan = Math.max(maxLat - minLat, 0.01);
    const lngSpan = Math.max(maxLng - minLng, 0.012);
    const place = (point: Point): PlacedPoint => ({
      ...point,
      x: 12 + ((point.longitude - minLng) / lngSpan) * 76,
      y: 16 + ((maxLat - point.latitude) / latSpan) * 66,
    });
    const routeDots = Array.from({ length: 15 }, (_, index) => {
      const t = index / 14;
      return place({
        latitude: store.latitude + (home.latitude - store.latitude) * t,
        longitude: store.longitude + (home.longitude - store.longitude) * t,
      });
    });
    return {
      store: place(store),
      home: place(home),
      rider: rider ? place(rider) : null,
      routeDots,
    };
  }, [order]);

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

  function openMaps() {
    const rider = map?.rider;
    if (!rider) {
      showToast('Rider location is not available yet', 'info');
      return;
    }
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${rider.latitude},${rider.longitude}`,
    ).catch(() => showToast('Maps are not available on this device', 'error'));
  }

  if (loading) {
    return (
      <View style={styles.fill}>
        <StatusBar style="dark" />
        <ScreenHeader title="Live tracking" onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="meta" tone="muted">
            Finding your rider…
          </AppText>
        </View>
      </View>
    );
  }

  if (!order || error) {
    return (
      <View style={styles.fill}>
        <StatusBar style="dark" />
        <ScreenHeader title="Live tracking" onBack={() => router.back()} />
        <ErrorState
          title="Tracking is unavailable"
          description={error ?? 'We couldn’t load this order.'}
          onRetry={() => load()}
        />
      </View>
    );
  }

  const tracking = order.tracking;
  const active = isActiveOrder(order.status);
  const riderLocated = tracking?.latitude != null && tracking?.longitude != null;
  const statusMeta = STATUS_META[order.status];

  return (
    <View style={styles.fill}>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Live tracking"
        subtitle={`#${order.orderNumber} · ${statusMeta.label}`}
        onBack={() => router.back()}
        right={
          <IconButton
            icon="refresh"
            onPress={() => load(true)}
            accessibilityLabel="Refresh tracking"
            size={38}
          />
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        {order.status === 'delivered' ? (
          <View style={styles.deliveredHero}>
            <View style={styles.deliveredIcon}>
              <Ionicons name="checkmark" size={28} color={colors.white} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="section" tone="primary">
                Delivered to your door
              </AppText>
              <AppText variant="meta" tone="muted">
                {order.deliveredAt ? formatDate(order.deliveredAt) : 'Thank you for shopping local.'}
              </AppText>
            </View>
          </View>
        ) : order.status === 'cancelled' ? (
          <View style={styles.cancelledHero}>
            <Ionicons name="close-circle" size={24} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyMedium" style={{ fontWeight: '700', color: colors.danger }}>
                This order was cancelled
              </AppText>
              <AppText variant="meta" tone="muted">
                {order.cancelReason || 'Live tracking is no longer available.'}
              </AppText>
            </View>
          </View>
        ) : (
          <Card style={styles.etaCard}>
            <View style={styles.etaTop}>
              <View style={{ flex: 1, gap: 3 }}>
                <AppText variant="meta" tone="muted">
                  {order.status === 'out_for_delivery' ? 'Arriving soon' : 'Estimated delivery'}
                </AppText>
                <AppText variant="title" style={{ fontSize: 26 }}>
                  {order.status === 'out_for_delivery'
                    ? '15–25 min'
                    : order.status === 'assigned'
                      ? '20–35 min'
                      : '30–45 min'}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {riderLocated
                    ? `Rider location updated ${relativeTime(tracking!.updatedAt).toLowerCase()}`
                    : 'Waiting for your rider to share their location.'}
                </AppText>
              </View>
              <View style={[styles.etaIcon, { backgroundColor: statusMeta.background }]}>
                <Ionicons
                  name={order.status === 'out_for_delivery' ? 'bicycle' : 'time-outline'}
                  size={25}
                  color={statusMeta.text}
                />
              </View>
            </View>
            <View style={styles.etaDivider} />
            <View style={styles.etaFooter}>
              <StatusPill status={order.status} compact />
              {riderLocated ? (
                <View style={styles.liveDotRow}>
                  <View style={styles.liveDot} />
                  <AppText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
                    Live location
                  </AppText>
                </View>
              ) : null}
            </View>
          </Card>
        )}

        {order.status !== 'cancelled' && map ? (
          <View style={styles.mapCard}>
            <View style={styles.mapHeader}>
              <View style={{ flex: 1, gap: 1 }}>
                <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
                  {riderLocated ? 'Your rider is on the map' : 'Delivery route'}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {order.deliveryPartner?.name || 'NeuraCart rider'} · {formatAddress(order.address, false)}
                </AppText>
              </View>
              <IconButton
                icon="open-outline"
                onPress={openMaps}
                accessibilityLabel="Open rider location in maps"
                size={34}
              />
            </View>

            <View style={styles.map}>
              <View style={styles.mapRoadHorizontal} />
              <View style={[styles.mapRoadHorizontal, styles.mapRoadLower]} />
              <View style={styles.mapRoadVertical} />
              <View style={[styles.mapRoadVertical, styles.mapRoadRight]} />
              <View style={styles.mapPark} />
              {map.routeDots.map((dot, index) => (
                <View
                  key={index}
                  style={[
                    styles.routeDot,
                    {
                      left: percent(dot.x),
                      top: percent(dot.y),
                      opacity: 0.35 + (index / map.routeDots.length) * 0.55,
                    },
                  ]}
                />
              ))}

              <MapPin
                x={map.store.x}
                y={map.store.y}
                icon="storefront"
                label="Store"
                color={colors.primaryDark}
                background={colors.primarySoft}
              />
              <MapPin
                x={map.home.x}
                y={map.home.y}
                icon="home"
                label="You"
                color={colors.primaryDark}
                background={colors.white}
              />
              {map.rider ? (
                <MapPin
                  x={map.rider.x}
                  y={map.rider.y}
                  icon="bicycle"
                  label="Rider"
                  color={colors.white}
                  background="#EA580C"
                  prominent
                />
              ) : null}

              <View style={styles.mapLegend}>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                  <AppText variant="caption" tone="muted">
                    NeuraCart route
                  </AppText>
                </View>
                {!riderLocated ? (
                  <View style={styles.waitingPill}>
                    <ActivityIndicator size="small" color={colors.warning} />
                    <AppText variant="caption" style={{ color: colors.warning, fontWeight: '700' }}>
                      Waiting for rider
                    </AppText>
                  </View>
                ) : null}
              </View>
            </View>
            <AppText variant="caption" tone="subtle" style={styles.mapNote}>
              Map is a live schematic based on the latest rider coordinates.
            </AppText>
          </View>
        ) : null}

        {order.deliveryPartner && order.status !== 'cancelled' ? (
          <Card style={styles.riderCard}>
            <View style={styles.riderTop}>
              <View style={styles.avatar}>
                <AppText variant="bodyMedium" tone="primary" style={{ fontWeight: '800' }}>
                  {initials(order.deliveryPartner.name, order.deliveryPartner.email)}
                </AppText>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
                  {order.deliveryPartner.name || 'Your delivery partner'}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {active ? 'Your neighbourhood delivery partner' : 'Completed your delivery'}
                </AppText>
                {order.accepted && active ? (
                  <Badge label="On the way" tone="green" icon="checkmark" />
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
            {active ? (
              <Button
                label="Call rider"
                onPress={callRider}
                icon="call"
                variant="secondary"
                size="sm"
              />
            ) : null}
          </Card>
        ) : null}

        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <AppText variant="section">Journey so far</AppText>
            <AppText variant="caption" tone="muted">
              Auto-refreshes every 15s
            </AppText>
          </View>
          <StatusTimeline status={order.status} history={order.statusHistory} />
        </Card>

        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <AppText variant="section">Delivering to</AppText>
            <Ionicons name="location-outline" size={18} color={colors.primaryDark} />
          </View>
          <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
            {order.address.label}
          </AppText>
          <AppText variant="meta" tone="muted">
            {formatAddress(order.address)}
          </AppText>
        </Card>

        <View style={styles.helpNote}>
          <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
          <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
            Rider locations refresh while the order is active. If the map pauses, pull down to
            refresh.
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

function percent(value: number): `${number}%` {
  return `${Math.max(2, Math.min(96, value))}%`;
}

function MapPin({
  x,
  y,
  icon,
  label,
  color,
  background,
  prominent = false,
}: {
  x: number;
  y: number;
  icon: string;
  label: string;
  color: string;
  background: string;
  prominent?: boolean;
}) {
  return (
    <View style={[styles.pinWrap, { left: percent(x), top: percent(y) }]}>
      <View
        style={[
          styles.pin,
          { backgroundColor: background },
          prominent && styles.pinProminent,
        ]}
      >
        <Ionicons name={icon as never} size={prominent ? 17 : 15} color={color} />
      </View>
      <View style={styles.pinLabel}>
        <AppText variant="caption" style={{ fontSize: 9, fontWeight: '700' }}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  content: { padding: 20, gap: 14, paddingBottom: 30 },
  deliveredHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    borderRadius: radius.xl,
    padding: 16,
  },
  deliveredIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelledHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.xl,
    padding: 16,
  },
  etaCard: { gap: 13 },
  etaTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  etaIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaDivider: { height: 1, backgroundColor: colors.border },
  etaFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveDotRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  mapCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  mapHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  map: {
    height: 278,
    marginHorizontal: 12,
    borderRadius: radius.lg,
    backgroundColor: '#E8F2EA',
    overflow: 'hidden',
    position: 'relative',
  },
  mapRoadHorizontal: {
    position: 'absolute',
    left: -20,
    right: -20,
    top: '32%',
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.86)',
    transform: [{ rotate: '-6deg' }],
  },
  mapRoadLower: {
    top: '72%',
    height: 13,
    transform: [{ rotate: '8deg' }],
  },
  mapRoadVertical: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    left: '26%',
    width: 13,
    backgroundColor: 'rgba(255,255,255,0.8)',
    transform: [{ rotate: '9deg' }],
  },
  mapRoadRight: { left: '74%', width: 18, transform: [{ rotate: '-5deg' }] },
  mapPark: {
    position: 'absolute',
    right: '8%',
    top: '8%',
    width: 70,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#CDE8D4',
  },
  routeDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginLeft: -2,
    marginTop: -2,
  },
  pinWrap: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -17 }, { translateY: -22 }],
    zIndex: 3,
  },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    ...shadows.card,
  },
  pinProminent: { width: 38, height: 38, borderRadius: 19 },
  pinLabel: {
    marginTop: 3,
    backgroundColor: colors.white,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
    ...shadows.card,
  },
  mapLegend: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  waitingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  mapNote: { paddingHorizontal: 14, paddingVertical: 10, textAlign: 'center' },
  riderCard: { gap: 12 },
  riderTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: { gap: 13 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  helpNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingHorizontal: 2 },
});
