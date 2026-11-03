import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, radius, shadows } from '@/constants/design';
import { apiPath, apiRequest, apiRequestPage } from '@/lib/api';
import { SUPPORT_EMAIL } from '@/lib/config';
import { firstName, initials } from '@/lib/format';
import { translate } from '@/lib/i18n';
import type { Address, Order } from '@/lib/types';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';
import { useToastStore } from '@/store/toast';

type MenuRowProps = {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightText?: string;
  disabled?: boolean;
  showChevron?: boolean;
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const language = useLanguageStore((state) => state.language);
  const t = (key: string) => translate(language, key);
  const signOut = useAuthStore((state) => state.signOut);
  const showToast = useToastStore((state) => state.show);
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [addressCount, setAddressCount] = useState(0);
  const [notifications, setNotifications] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [orderResponse, addresses] = await Promise.all([
            apiRequestPage<Order>(apiPath('/orders/my', { page: 1, limit: 50 })),
            apiRequest<Address[]>('/addresses'),
          ]);
          if (!active) return;
          setOrders(orderResponse.data);
          setTotalOrders(orderResponse.pagination.total);
          setAddressCount(addresses.length);
        } catch {
          // Stats are supplementary; the profile remains usable without them.
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  function confirmSignOut() {
    Alert.alert(
      'Sign out of NeuraCart?',
      'Your cart is saved per account and will be cleared on this device when you sign out.',
      [
        { text: 'Stay signed in', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)');
          },
        },
      ],
    );
  }

  function showAbout() {
    Alert.alert(
      'NeuraCart',
      `Your neighbourhood market, delivered.\n\nVersion ${Constants.expoConfig?.version ?? '1.0.0'}\nBengaluru, India\n\nQuestions? ${SUPPORT_EMAIL}`,
    );
  }

  function showPrivacy() {
    Alert.alert(
      'Privacy, simply put',
      'We use your email and delivery address only to operate your NeuraCart account and fulfil orders. OTPs and refresh tokens are stored securely. We never sell your personal data.',
    );
  }

  const delivered = orders.filter((order) => order.status === 'delivered').length;
  const active = orders.filter((order) =>
    ['pending', 'confirmed', 'preparing', 'assigned', 'out_for_delivery'].includes(order.status),
  ).length;
  const displayName = user?.name?.trim() || firstName(user?.name);

  return (
    <View style={styles.fill}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <View style={{ flex: 1, gap: 3 }}>
            <AppText variant="title">{t('tabs.profile')}</AppText>
            <AppText variant="body" tone="muted">
              {t('profile.corner')}
            </AppText>
          </View>
          <View style={styles.headerMark}>
            <Ionicons name="leaf" size={19} color={colors.primaryDark} />
          </View>
        </View>

        <View style={styles.body}>
          <LinearGradient
            colors={['#14532D', '#15803D', '#16A34A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileCard}
          >
            <View style={styles.profileBubble} />
            <View style={styles.profileTop}>
              <View style={styles.avatar}>
                <AppText variant="title" style={{ color: colors.primaryDark }}>
                  {initials(user?.name, user?.email)}
                </AppText>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <AppText variant="section" tone="white">
                  {displayName}
                </AppText>
                <AppText variant="meta" style={{ color: 'rgba(255,255,255,0.74)' }}>
                  {user?.email}
                </AppText>
                <View style={styles.memberPill}>
                  <Ionicons name="sparkles" size={10} color="#FDE68A" />
                  <AppText variant="caption" style={{ color: '#FEF3C7', fontWeight: '700' }}>
                    {t('profile.member')}
                  </AppText>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
                onPress={() => router.push('/edit-profile')}
                style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.75 }]}
              >
                <Ionicons name="create-outline" size={17} color={colors.white} />
              </Pressable>
            </View>

            <View style={styles.stats}>
              <Stat label={t('profile.statOrders')} value={String(totalOrders)} />
              <View style={styles.statDivider} />
              <Stat label={t('profile.statDelivered')} value={String(delivered)} />
              <View style={styles.statDivider} />
              <Stat label={t('profile.statActive')} value={String(active)} />
            </View>
          </LinearGradient>

          <View style={styles.quickRow}>
            <QuickAction
              icon="receipt-outline"
              label={t('profile.quickOrders')}
              onPress={() => router.push('/(tabs)/orders')}
            />
            <QuickAction
              icon="location-outline"
              label={t('profile.quickAddresses')}
              badge={addressCount ? String(addressCount) : undefined}
              onPress={() => router.push('/addresses')}
            />
            <QuickAction
              icon="headset-outline"
              label={t('profile.quickSupport')}
              onPress={() => router.push('/help')}
            />
          </View>

          <View style={styles.section}>
            <AppText variant="meta" tone="muted" style={styles.sectionLabel}>
              {t('profile.account')}
            </AppText>
            <Card padded={false} style={styles.menuCard}>
              <MenuRow
                icon="person-outline"
                title={t('profile.editProfile')}
                subtitle={t('profile.editProfileSub')}
                onPress={() => router.push('/edit-profile')}
              />
              <MenuRow
                icon="location-outline"
                title={t('profile.savedAddresses')}
                subtitle={t('profile.savedAddressesSub')}
                rightText={addressCount ? `${addressCount}/10` : undefined}
                onPress={() => router.push('/addresses')}
              />
              <MenuRow
                icon="wallet-outline"
                title={t('profile.wallet')}
                subtitle={t('profile.walletSub')}
                onPress={() => router.push('/wallet')}
              />
              <MenuRow
                icon="repeat-outline"
                title={t('profile.subscriptions')}
                subtitle={t('profile.subscriptionsSub')}
                onPress={() => router.push('/subscriptions')}
              />
              <MenuRow
                icon="receipt-outline"
                title={t('profile.orderHistory')}
                subtitle={t('profile.orderHistorySub')}
                onPress={() => router.push('/(tabs)/orders')}
                last
              />
            </Card>
          </View>

          <View style={styles.section}>
            <AppText variant="meta" tone="muted" style={styles.sectionLabel}>
              {t('profile.preferences')}
            </AppText>
            <Card padded={false} style={styles.menuCard}>
              <MenuRow
                icon="restaurant-outline"
                title={t('profile.dietary')}
                subtitle={t('profile.dietarySub')}
                onPress={() => router.push('/dietary-preferences')}
              />
              <View style={styles.menuRow}>
                <View style={[styles.menuIcon, { backgroundColor: colors.warningSoft }]}>
                  <Ionicons name="notifications-outline" size={19} color={colors.warning} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.menuTitleRow}>
                    <AppText variant="bodyMedium" style={{ fontWeight: '600' }}>
                      {t('profile.notifications')}
                    </AppText>
                    <Badge label={t('profile.soon')} tone="gray" />
                  </View>
                  <AppText variant="caption" tone="muted">
                    {t('profile.notificationsSub')}
                  </AppText>
                </View>
                <Switch
                  value={notifications}
                  onValueChange={(value) => {
                    setNotifications(value);
                    showToast('Notification preferences are coming soon', 'info');
                  }}
                  disabled
                  trackColor={{ false: colors.borderStrong, true: colors.primaryMuted }}
                  thumbColor={colors.white}
                />
              </View>
              <MenuRow
                icon="shield-checkmark-outline"
                title={t('profile.privacy')}
                subtitle={t('profile.privacySub')}
                onPress={showPrivacy}
              />
              <MenuRow
                icon="information-circle-outline"
                title={t('profile.about')}
                subtitle={t('profile.aboutSub')}
                onPress={showAbout}
                last
              />
            </Card>
          </View>

          <View style={styles.section}>
            <AppText variant="meta" tone="muted" style={styles.sectionLabel}>
              {t('profile.support')}
            </AppText>
            <Card padded={false} style={styles.menuCard}>
              <MenuRow
                icon="chatbubble-ellipses-outline"
                title={t('profile.help')}
                subtitle={t('profile.helpSub')}
                onPress={() => router.push('/help')}
              />
              <MenuRow
                icon="shield-checkmark-outline"
                title={t('profile.terms')}
                subtitle={t('profile.termsSub')}
                onPress={showPrivacy}
                last
              />
            </Card>
          </View>

          <Button
            label={t('profile.signOut')}
            onPress={confirmSignOut}
            variant="secondary"
            icon="log-out-outline"
            style={styles.signOut}
          />

          <AppText variant="caption" tone="subtle" style={styles.footer}>
            NeuraCart · Made for Bengaluru · v{Constants.expoConfig?.version ?? '1.0.0'}
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="card" tone="white" style={{ fontSize: 18 }}>
        {value}
      </AppText>
      <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.66)' }}>
        {label}
      </AppText>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  badge,
  onPress,
}: {
  icon: string;
  label: string;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.quick, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.quickIcon}>
        <Ionicons name={icon as never} size={21} color={colors.primaryDark} />
        {badge ? (
          <View style={styles.quickBadge}>
            <AppText style={styles.quickBadgeText}>{badge}</AppText>
          </View>
        ) : null}
      </View>
      <AppText variant="caption" style={{ fontWeight: '700' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
  rightText,
  disabled = false,
  showChevron = true,
  last = false,
}: MenuRowProps & { last?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.menuRow,
        !last && styles.menuBorder,
        pressed && !disabled && { backgroundColor: colors.background },
      ]}
    >
      <View style={styles.menuIcon}>
        <Ionicons name={icon as never} size={19} color={colors.primaryDark} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyMedium" style={{ fontWeight: '600' }}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {rightText ? (
        <AppText variant="caption" tone="muted">
          {rightText}
        </AppText>
      ) : null}
      {showChevron && onPress ? (
        <Ionicons name="chevron-forward" size={17} color={colors.subtle} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 20, gap: 16 },
  profileCard: {
    borderRadius: radius.xxl,
    padding: 18,
    gap: 18,
    overflow: 'hidden',
    ...shadows.card,
  },
  profileBubble: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.06)',
    right: -60,
    top: -50,
  },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginTop: 2,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.lg,
    paddingVertical: 11,
  },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.18)' },
  quickRow: { flexDirection: 'row', gap: 10 },
  quick: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 13,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBadge: {
    position: 'absolute',
    top: -3,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  quickBadgeText: { fontSize: 8, lineHeight: 10, color: colors.white, fontWeight: '800' },
  section: { gap: 7 },
  sectionLabel: { letterSpacing: 0.8, fontSize: 10, fontWeight: '700', marginLeft: 3 },
  menuCard: { overflow: 'hidden' },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 64,
  },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  signOut: { marginTop: 2 },
  footer: { textAlign: 'center', marginTop: 2 },
});
