import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Linking, StyleSheet, Switch, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ConfirmAction } from '@/components/ConfirmAction';
import { colors } from '@/constants/design';
import { SUPPORT_PHONE } from '@/lib/config';
import { formatDate, initials, money } from '@/lib/format';
import { useState } from 'react';
import { useDeliveryStore } from '@/store/delivery';
import { useToastStore } from '@/store/toast';

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useDeliveryStore((state) => state.profile);
  const signOut = useDeliveryStore((state) => state.signOut);
  const setAvailability = useDeliveryStore((state) => state.setAvailability);
  const toast = useToastStore((state) => state.show);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const toggleAvailability = async (value: boolean) => {
    try {
      await setAvailability(value);
      toast(value ? 'You are online.' : 'You are offline.');
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not update availability.');
    }
  };

  const signOutNow = async () => {
    setConfirmSignOut(false);
    await signOut();
    router.replace('/login');
  };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#14532D', '#15803D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <View style={styles.avatar}>
          <AppText variant="title" tone="white">
            {initials(profile?.name, profile?.email)}
          </AppText>
        </View>
        <AppText variant="section" tone="white">
          {profile?.name ?? 'Rider'}
        </AppText>
        <AppText variant="meta" tone="white" style={styles.headerMeta}>
          {profile?.email ?? '—'}
        </AppText>
        {profile?.phone ? (
          <AppText variant="meta" tone="white" style={styles.headerMeta}>
            {profile.phone}
          </AppText>
        ) : null}
      </LinearGradient>

      <View style={styles.body}>
        <Card style={styles.vehicle}>
          <View style={styles.vehicleIcon}>
            <Ionicons name="bicycle" size={20} color={colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="card">Vehicle</AppText>
            <AppText variant="meta" tone="muted">
              {titleCase(profile?.vehicleType ?? 'Bike')} · {profile?.vehicleNumber ?? '—'}
            </AppText>
          </View>
          <View style={styles.verifyBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.primaryDark} />
            <AppText variant="caption" tone="primary">
              Verified
            </AppText>
          </View>
        </Card>

        <View style={styles.statsRow}>
          <Card style={styles.stat}>
            <AppText variant="title" tone="primary">
              {profile?.totalDeliveries ?? 0}
            </AppText>
            <AppText variant="caption" tone="muted">
              Deliveries
            </AppText>
          </Card>
          <Card style={styles.stat}>
            <AppText variant="title" tone="primary">
              {money(profile?.earnings ?? 0)}
            </AppText>
            <AppText variant="caption" tone="muted">
              Earnings
            </AppText>
          </Card>
          <Card style={styles.stat}>
            <AppText variant="caption" tone="muted" style={styles.statSmall}>
              Member
            </AppText>
            <AppText variant="meta">
              {formatDate(profile?.memberSince)}
            </AppText>
          </Card>
        </View>

        <Card style={styles.rowCard}>
          <View style={{ flex: 1 }}>
            <AppText variant="card">Available for deliveries</AppText>
            <AppText variant="caption" tone="muted">
              Go offline at the end of your shift to stop receiving assignments.
            </AppText>
          </View>
          <Switch
            accessibilityLabel="Availability switch"
            value={profile?.isAvailable ?? false}
            onValueChange={(value) => void toggleAvailability(value)}
            trackColor={{ false: colors.borderStrong, true: colors.primary }}
            thumbColor={colors.white}
          />
        </Card>

        <Card style={styles.helpCard}>
          <View style={styles.helpRow}>
            <Ionicons name="call-outline" size={17} color={colors.primaryDark} />
            <AppText variant="bodyMedium" style={styles.helpText}>
              Help & support
            </AppText>
            <AppText variant="meta" tone="primary" onPress={() => void callStore()}>
              Call store
            </AppText>
          </View>
          <AppText variant="caption" tone="subtle">
            {SUPPORT_PHONE} · riders are managed by the store, not edited here.
          </AppText>
        </Card>

        <AppText variant="caption" tone="subtle" style={styles.version}>
          NeuraCart Delivery v{appVersion}
        </AppText>

        <Card style={[styles.signOutCard, styles.signOutContent]}>
          <AppText variant="bodyMedium" tone="danger" onPress={() => setConfirmSignOut(true)}>
            Sign out
          </AppText>
        </Card>
      </View>

      <ConfirmAction
        open={confirmSignOut}
        title="Sign out of NeuraCart Delivery?"
        description="You will need to sign in again to receive new assignments."
        confirmLabel="Sign out"
        tone="danger"
        onConfirm={() => void signOutNow()}
        onClose={() => setConfirmSignOut(false)}
      />
    </View>
  );
}

async function callStore() {
  try {
    await Linking.openURL(`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`);
  } catch {
    // Devices without telephony simply do nothing here.
  }
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    alignItems: 'center',
    paddingTop: 62,
    paddingBottom: 22,
    gap: 5,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  headerMeta: { opacity: 0.85 },
  body: { padding: 20, gap: 12 },
  vehicle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vehicleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 14 },
  statSmall: { marginBottom: -2 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  helpCard: { gap: 6 },
  helpRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  helpText: { flex: 1 },
  version: { textAlign: 'center', marginTop: 6 },
  signOutCard: { borderColor: '#FECACA', backgroundColor: colors.dangerSoft },
  signOutContent: { alignItems: 'center', paddingVertical: 13 },
});
