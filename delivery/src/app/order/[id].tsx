import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmAction } from '@/components/ConfirmAction';
import { EmptyState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { apiRequest, apiUpload } from '@/lib/api';
import { colors, radius } from '@/constants/design';
import { STORE_PREVIEW } from '@/lib/config';
import {
  STATUS_META,
  formatDate,
  formatShortDate,
  maskPhone,
  money,
  pluralize,
} from '@/lib/format';
import { useDeliveryStore } from '@/store/delivery';
import { useToastStore } from '@/store/toast';

type PendingAction = 'start' | 'complete' | 'decline' | 'accept' | null;

type BatchOrder = {
  id: string;
  orderNumber: string;
  status: string;
  address: { line1: string; pincode: string };
};

type Batch = { id: string; orders: BatchOrder[] } | null;

export default function AssignmentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const orderId = params.id ?? '';
  const toast = useToastStore((state) => state.show);

  const assignments = useDeliveryStore((state) => state.assignments);
  const busy = useDeliveryStore((state) => state.busy);
  const findAssignmentFn = useDeliveryStore((state) => state.findAssignment);
  const fetchAssignments = useDeliveryStore((state) => state.fetchAssignments);
  const accept = useDeliveryStore((state) => state.accept);
  const reject = useDeliveryStore((state) => state.reject);
  const start = useDeliveryStore((state) => state.start);
  const complete = useDeliveryStore((state) => state.complete);

  const [pending, setPending] = useState<PendingAction>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [otp, setOtp] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [podSent, setPodSent] = useState(false);
  const [podVerified, setPodVerified] = useState(false);
  const [podBusy, setPodBusy] = useState<'send' | 'verify' | null>(null);
  const [batch, setBatch] = useState<Batch>(null);

  const order = assignments ? findAssignmentFn(orderId) : null;

  const refresh = useCallback(async () => {
    await fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!order?.batchId) return;
    void apiRequest<Batch>('/delivery/batch')
      .then(setBatch)
      .catch(() => setBatch(null));
  }, [order?.batchId]);

  const sendProofCode = async () => {
    if (!order) return;
    setPodBusy('send');
    try {
      const result = await apiRequest<{ sent: boolean; devOtp?: string }>(
        `/delivery/assignments/${order.id}/proof/send`,
        { method: 'POST' },
      );
      setPodSent(true);
      toast(
        result.devOtp
          ? `Delivery code for testing: ${result.devOtp}`
          : `Code sent to ${order.customer.name ?? 'the customer'}.`,
      );
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not send the delivery code.');
    } finally {
      setPodBusy(null);
    }
  };

  const pickProofPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    const result = permission.granted
      ? await ImagePicker.launchCameraAsync({ quality: 0.5 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.5, mediaTypes: ['images'] });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPhoto({
      uri: asset.uri,
      name: asset.fileName ?? `proof-${order?.orderNumber ?? 'order'}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    });
  };

  const verifyProof = async () => {
    if (!order || !photo || otp.length !== 4) return;
    setPodBusy('verify');
    try {
      const form = new FormData();
      form.append('otp', otp);
      form.append('photo', photo as unknown as Blob);
      await apiUpload(`/delivery/assignments/${order.id}/proof`, form);
      setPodVerified(true);
      toast('Delivery code verified.');
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not verify the delivery code.');
    } finally {
      setPodBusy(null);
    }
  };

  const masked = order ? order.accepted || order.status !== 'assigned' : false;

  const runAction = async () => {
    if (!pending || !order) return;
    const kind: PendingAction = pending;
    setPending(null);
    try {
      if (kind === 'accept') await accept(order.id);
      if (kind === 'decline') await reject(order.id);
      if (kind === 'start') await start(order.id);
      if (kind === 'complete') await complete(order.id);
      toast(
        kind === 'complete'
          ? `${order.orderNumber} delivered · ₹${Number(order.payout ?? 40).toFixed(0)} earned`
          : kind === 'decline'
            ? `${order.orderNumber} declined`
            : `${order.orderNumber} updated.`,
      );
      if (kind === 'complete') router.replace('/assignments');
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not update the order.');
    } finally {
      void refresh();
    }
  };

  if (!order) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.center}>
        {!assignments || !!busy ? (
          <>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="body" tone="muted" style={styles.centerHint}>
              Loading assignment…
            </AppText>
          </>
        ) : (
          <EmptyState
            icon="close-circle-outline"
            title="This assignment is no longer active"
            description="It may have been reassigned, cancelled, or completed. Pull the latest from assignments."
            actionLabel="Back to assignments"
            onAction={() => router.back()}
          />
        )}
      </ScrollView>
    );
  }

  const isAssigned = order.status === 'assigned';
  const isDone = order.status === 'delivered';
  const isOut = order.status === 'out_for_delivery';

  const confirm: Record<Exclude<PendingAction, null>, { title: string; description: string; label: string }> = {
    accept: {
      title: `Accept ${order.orderNumber}?`,
      description: 'Pickup from the store. You earn ₹' + Number(order.payout ?? 40).toFixed(0) + ' on delivery.',
      label: 'Accept',
    },
    decline: {
      title: `Decline ${order.orderNumber}?`,
      description: 'The order returns to the store for another rider.',
      label: 'Decline',
    },
    start: {
      title: `Start delivery for ${order.orderNumber}?`,
      description: 'The customer is told you are on the way.',
      label: 'Out for delivery',
    },
    complete: {
      title: `Deliver ${order.orderNumber}?`,
      description: 'Confirm the order has been handed to the customer. COD cash is collected at this step.',
      label: 'Delivered',
    },
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <LinearGradient
        colors={['#14532D', '#15803D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to assignments"
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={18} color={colors.white} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <AppText variant="section" tone="white">
              {order.orderNumber}
            </AppText>
            <AppText variant="meta" tone="white" style={styles.headerHint}>
              {formatShortDate(order.createdAt)} · {order.paymentMethod === 'cod' ? 'COD' : 'Online'}
            </AppText>
          </View>
          <Badge label={STATUS_META[order.status].label} tone={isDone ? 'green' : isAssigned ? 'amber' : 'blue'} />
        </View>
      </LinearGradient>

      <Card style={styles.payout}>
        <Ionicons name="cash-outline" size={20} color={colors.primaryDark} />
        <View style={{ flex: 1 }}>
          <AppText variant="card">
            You earn {money(order.payout ?? 40)} for this delivery
          </AppText>
          <AppText variant="caption" tone="muted">
            No deductions · credited when the order is marked delivered.
          </AppText>
        </View>
      </Card>

      <Card style={styles.placeCard}>
        <View style={styles.placeHead}>
          <View style={styles.placeIcon}>
            <BrandMark size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="card">Pickup from {STORE_PREVIEW.name}</AppText>
            <AppText variant="meta" tone="muted">
              {STORE_PREVIEW.address}, {STORE_PREVIEW.city} {STORE_PREVIEW.pincode}
            </AppText>
          </View>
        </View>
        <View style={styles.placeActions}>
          <Button
            label="Open maps"
            icon="map-outline"
            size="sm"
            fullWidth={false}
            onPress={() =>
              void Linking.openURL(
                `https://www.google.com/maps/search/?api=1&query=${STORE_PREVIEW.latitude},${STORE_PREVIEW.longitude}`,
              ).catch(() => undefined)}
          />
          <Button
            label="Call store"
            icon="call-outline"
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() => void Linking.openURL(`tel:${STORE_PREVIEW.phone.replace(/\s/g, '')}`).catch(() => undefined)}
          />
        </View>
      </Card>

      <Card style={styles.placeCard}>
        <View style={styles.placeHead}>
          <View style={[styles.placeIcon, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="person" size={15} color="#1D4ED8" />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="card">Drop to {order.customer.name ?? 'Customer'}</AppText>
            <AppText variant="meta" tone="muted">
              {[order.address.line1, order.address.line2, `${order.address.city} ${order.address.pincode}`]
                .filter(Boolean)
                .join(', ')}
            </AppText>
            <AppText variant="meta" tone="subtle">
              {order.address.label} · Phone {maskPhone(order.customer.phone, masked)}
            </AppText>
          </View>
        </View>
        {masked ? (
          <View style={styles.placeActions}>
            <Button
              label="Call customer"
              icon="call-outline"
              size="sm"
              fullWidth={false}
              disabled={!order.customer.phone}
              onPress={() =>
                void Linking.openURL(`tel:${order.customer.phone}`).catch(() => undefined)}
            />
            {order.address.latitude && order.address.longitude ? (
              <Button
                label="Open maps"
                icon="map-outline"
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() =>
                  void Linking.openURL(
                    `https://www.google.com/maps/search/?api=1&query=${order.address.latitude},${order.address.longitude}`,
                  ).catch(() => undefined)}
              />
            ) : null}
          </View>
        ) : null}
        {order.notes ? (
          <View style={styles.note}>
            <AppText variant="caption" tone="muted">
              Customer note: <AppText style={{ fontWeight: '600' }}>{order.notes}</AppText>
            </AppText>
          </View>
        ) : null}
      </Card>

      <Card style={styles.itemsCard}>
        <AppText variant="card">
          {order.itemCount} {pluralize(order.itemCount, 'item')} in {order.items.length} product{order.items.length === 1 ? '' : 's'}
        </AppText>
        <View style={styles.itemsList}>
          {order.items.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!checked[item.id] }}
              accessibilityLabel={`Picked up ${item.quantity} x ${item.product.name}`}
              onPress={() => setChecked((state) => ({ ...state, [item.id]: !state[item.id] }))}
              style={styles.itemRow}
            >
              <Ionicons
                name={checked[item.id] ? 'checkbox' : 'checkbox-outline'}
                size={19}
                color={checked[item.id] ? colors.primary : colors.subtle}
              />
              <AppText variant="bodyMedium" style={styles.itemName}>
                {item.product.name}
              </AppText>
              <AppText variant="meta" tone="muted">
                {item.quantity}× {item.product.unit}
              </AppText>
            </Pressable>
          ))}
        </View>
        {isAssigned && !order.accepted ? (
          <AppText variant="caption" tone="subtle">
            Tick items as you pack them — this checklist is only for you.
          </AppText>
        ) : null}
      </Card>

      {isOut ? (
        <Card style={styles.itemsCard}>
          <View style={styles.podHead}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primaryDark} />
            <AppText variant="card">Proof of delivery</AppText>
          </View>
          {podVerified ? (
            <AppText variant="bodyMedium" tone="primary">
              Verified — you can mark the order delivered now.
            </AppText>
          ) : !podSent ? (
            <>
              <AppText variant="caption" tone="muted">
                Send a 4-digit code to the customer, then confirm it here with a photo of the
                handover.
              </AppText>
              <Button
                label="Send delivery code"
                icon="paper-plane-outline"
                loading={podBusy === 'send'}
                onPress={() => void sendProofCode()}
              />
            </>
          ) : (
            <>
              <TextField
                label="Delivery code"
                placeholder="4-digit code"
                value={otp}
                onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
              />
              <Button
                label={photo ? 'Retake proof photo' : 'Take proof photo'}
                icon="camera-outline"
                variant="ghost"
                onPress={() => void pickProofPhoto()}
              />
              {photo ? (
                <AppText variant="caption" tone="primary">
                  Photo attached
                </AppText>
              ) : (
                <AppText variant="caption" tone="muted">
                  A photo is required to complete the delivery.
                </AppText>
              )}
              <Button
                label="Verify code"
                loading={podBusy === 'verify'}
                disabled={!photo || otp.length !== 4 || !!podBusy}
                onPress={() => void verifyProof()}
              />
            </>
          )}
        </Card>
      ) : null}

      {order.batchId && batch && batch.orders.length > 1 ? (
        <Card style={styles.itemsCard}>
          <AppText variant="card">Paired delivery</AppText>
          {batch.orders.map((paired) => (
            <View key={paired.id} style={styles.batchRow}>
              <Ionicons
                name={paired.id === order.id ? 'radio-button-on' : 'radio-button-off'}
                size={16}
                color={paired.id === order.id ? colors.primary : colors.subtle}
              />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyMedium">{paired.orderNumber}</AppText>
                <AppText variant="caption" tone="muted">
                  {paired.address.line1} · {paired.address.pincode}
                </AppText>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={styles.timelineCard}>
        <AppText variant="card">Status</AppText>
        {order.statusHistory.slice().reverse().map((entry) => (
          <View key={entry.id} style={styles.timelineRow}>
            <View style={styles.timelineDot} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyMedium">{STATUS_META[entry.status].label}</AppText>
              <AppText variant="caption" tone="subtle">
                {entry.note ?? 'Status updated'} · {formatDate(entry.createdAt)}
              </AppText>
            </View>
          </View>
        ))}
        {isDone ? (
          <View style={styles.deliveredRow}>
            <Ionicons name="checkmark-done-circle" size={17} color={colors.primaryDark} />
            <AppText variant="bodyMedium" tone="primary">
              Delivered {formatDate(order.deliveredAt ?? order.createdAt)}
            </AppText>
          </View>
        ) : null}
      </Card>

      <View style={styles.sticky}>
        {isDone ? (
          <Card style={[styles.doneCard]}>
            <AppText variant="bodyMedium" tone="primary" style={{ textAlign: 'center' }}>
              Delivered · payout {money(order.payout ?? 40)} credited
            </AppText>
          </Card>
        ) : isAssigned && !order.accepted ? (
          <View style={styles.stickyRow}>
            <Button label="Decline" variant="ghost" style={styles.grow} onPress={() => setPending('decline')} />
            <Button
              label="Accept"
              style={styles.grow}
              loading={busy === `accept:${order.id}`}
              disabled={!!busy}
              onPress={() => setPending('accept')}
            />
          </View>
        ) : (
          <Button
            label={
              isAssigned
                ? 'Start delivery'
                : podVerified
                  ? 'Mark as delivered'
                  : 'Verify proof to complete'
            }
            style={{ width: '100%' }}
            loading={busy === `start:${order.id}` || busy === `complete:${order.id}`}
            disabled={!!busy || (isOut && !podVerified)}
            onPress={() => setPending(isAssigned ? 'start' : 'complete')}
          />
        )}
      </View>

      <ConfirmAction
        open={!!pending}
        title={pending ? confirm[pending].title : ''}
        description={pending ? confirm[pending].description : ''}
        confirmLabel={pending ? confirm[pending].label : ''}
        busy={!!pending && !!busy}
        tone={pending === 'decline' ? 'danger' : 'primary'}
        onConfirm={() => void runAction()}
        onClose={() => setPending(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 120 },
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 32,
  },
  centerHint: { textAlign: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerHint: { opacity: 0.85, marginTop: 2 },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 16,
    borderColor: colors.primary,
  },
  placeCard: { marginHorizontal: 20, marginTop: 12, gap: 12 },
  placeHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  placeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeActions: { flexDirection: 'row', gap: 10, paddingLeft: 44 },
  note: {
    backgroundColor: colors.input,
    borderRadius: radius.md,
    padding: 10,
  },
  itemsCard: { marginHorizontal: 20, marginTop: 12, gap: 10 },
  itemsList: { gap: 2 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 7,
  },
  itemName: { flex: 1 },
  podHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  batchRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 6 },
  timelineCard: { marginHorizontal: 20, marginTop: 12, gap: 10 },
  timelineRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  timelineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  deliveredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  sticky: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 16,
  },
  stickyRow: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1, width: undefined },
  doneCard: { paddingVertical: 12 },
});
