import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/Header';
import { TextField } from '@/components/ui/TextField';
import { colors, radius } from '@/constants/design';
import { apiErrorMessage, apiRequest } from '@/lib/api';
import { money } from '@/lib/format';
import { useToastStore } from '@/store/toast';

type WalletTxn = {
  id: string;
  type: string;
  amount: number;
  note: string | null;
  orderId: string | null;
  createdAt: string;
};

type WalletInfo = { balance: number; transactions: WalletTxn[] };

type LoyaltyInfo = {
  points: number;
  lifetimeSpend: number;
  tier: string;
  perks: string[];
  nextTier: { tier: string; spendRemaining: number; perks: string[] } | null;
  pointValue: number;
  maxRedeemPct: number;
};

type ReferralInfo = {
  code: string;
  referredCount: number;
  creditsEarned: number;
  reward: number;
};

export default function WalletScreen() {
  const router = useRouter();
  const showToast = useToastStore((state) => state.show);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyInfo | null>(null);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const [walletResult, loyaltyResult, referralResult] = await Promise.allSettled([
      apiRequest<WalletInfo>('/money/wallet'),
      apiRequest<LoyaltyInfo>('/money/loyalty'),
      apiRequest<ReferralInfo>('/money/referrals'),
    ]);
    if (walletResult.status === 'fulfilled') setWallet(walletResult.value);
    if (loyaltyResult.status === 'fulfilled') setLoyalty(loyaltyResult.value);
    if (referralResult.status === 'fulfilled') setReferral(referralResult.value);
    const firstFailure = [walletResult, loyaltyResult, referralResult].find(
      (result) => result.status === 'rejected',
    );
    if (firstFailure?.status === 'rejected') setError(apiErrorMessage(firstFailure.reason));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void load().finally(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function copyCode() {
    if (!referral) return;
    await Clipboard.setStringAsync(referral.code);
    showToast('Referral code copied');
  }

  async function applyCode() {
    if (applying) return;
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      showToast('Enter a referral code first', 'error');
      return;
    }
    setApplying(true);
    try {
      await apiRequest('/money/referrals/apply', {
        method: 'POST',
        body: { code: trimmed },
      });
      setCode('');
      showToast('Referral applied — credit added to your wallet');
      await load();
    } catch (caught) {
      showToast(apiErrorMessage(caught), 'error');
    } finally {
      setApplying(false);
    }
  }

  return (
    <View style={styles.fill}>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Wallet & rewards"
        subtitle="Balance, points and referrals"
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {loading ? (
          <Card style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="meta" tone="muted">
              Loading your wallet…
            </AppText>
          </Card>
        ) : error && !wallet ? (
          <Card style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={22} color={colors.danger} />
            <AppText variant="meta" tone="danger" style={{ textAlign: 'center' }}>
              {error}
            </AppText>
            <Pressable onPress={refresh} hitSlop={6}>
              <AppText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
                Retry
              </AppText>
            </Pressable>
          </Card>
        ) : (
          <>
            <Card style={styles.balanceCard}>
              <View style={styles.balanceTop}>
                <View style={{ gap: 2 }}>
                  <AppText variant="caption" tone="muted">
                    Wallet balance
                  </AppText>
                  <AppText variant="price" style={{ fontSize: 30 }}>
                    {money(wallet?.balance ?? 0)}
                  </AppText>
                </View>
                <View style={styles.balanceIcon}>
                  <Ionicons name="wallet" size={24} color={colors.primaryDark} />
                </View>
              </View>
              <AppText variant="caption" tone="muted">
                Credit from referrals, refunds and goodwill is applied automatically at checkout.
              </AppText>
            </Card>

            {loyalty ? (
              <Card style={styles.loyaltyCard}>
                <View style={styles.balanceTop}>
                  <View style={{ gap: 2 }}>
                    <AppText variant="caption" tone="muted">
                      Loyalty tier
                    </AppText>
                    <AppText variant="section">{loyalty.tier}</AppText>
                  </View>
                  <View style={styles.pointsPill}>
                    <Ionicons name="star" size={15} color={colors.primaryDark} />
                    <AppText variant="meta" tone="primary" style={{ fontWeight: '800' }}>
                      {loyalty.points} pts
                    </AppText>
                  </View>
                </View>
                <View style={styles.perkList}>
                  {loyalty.perks.map((perk) => (
                    <View key={perk} style={styles.perkRow}>
                      <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
                      <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
                        {perk}
                      </AppText>
                    </View>
                  ))}
                </View>
                {loyalty.nextTier ? (
                  <AppText variant="caption" tone="muted">
                    Spend {money(loyalty.nextTier.spendRemaining)} more to reach{' '}
                    {loyalty.nextTier.tier}. 1 point = {money(loyalty.pointValue)}, redeemable up to{' '}
                    {loyalty.maxRedeemPct}% of items.
                  </AppText>
                ) : (
                  <AppText variant="caption" tone="muted">
                    You are on the highest tier. 1 point = {money(loyalty.pointValue)}.
                  </AppText>
                )}
              </Card>
            ) : null}

            {referral ? (
              <Card style={styles.referralCard}>
                <AppText variant="section">Refer a friend</AppText>
                <AppText variant="caption" tone="muted">
                  They get {money(referral.reward)} off their first order; you earn the same in wallet
                  credit.
                </AppText>
                <Pressable onPress={copyCode} style={styles.codeBox}>
                  <AppText variant="bodyMedium" style={{ fontWeight: '800', letterSpacing: 2 }}>
                    {referral.code}
                  </AppText>
                  <Ionicons name="copy-outline" size={18} color={colors.primaryDark} />
                </Pressable>
                <AppText variant="caption" tone="muted">
                  {referral.referredCount} friend{referral.referredCount === 1 ? '' : 's'} joined ·{' '}
                  {money(referral.creditsEarned)} earned
                </AppText>
                <TextField
                  label="Have a friend's code?"
                  placeholder="Enter code"
                  value={code}
                  onChangeText={(value) => setCode(value.toUpperCase().slice(0, 12))}
                  autoCapitalize="characters"
                  editable={!applying}
                  hint="One referral per account, on your first order."
                />
                <Pressable
                  onPress={applyCode}
                  disabled={applying}
                  style={[styles.applyButton, applying && { opacity: 0.6 }]}
                >
                  <AppText variant="meta" tone="primary" style={{ fontWeight: '800' }}>
                    {applying ? 'Applying…' : 'Apply code'}
                  </AppText>
                </Pressable>
              </Card>
            ) : null}

            <View style={styles.sectionHeading}>
              <AppText variant="section">Recent activity</AppText>
              <AppText variant="caption" tone="muted">
                Last {wallet?.transactions.length ?? 0}
              </AppText>
            </View>
            <Card style={{ gap: 0 }}>
              {(wallet?.transactions.length ?? 0) === 0 ? (
                <AppText variant="meta" tone="muted" style={{ paddingVertical: 8 }}>
                  No wallet activity yet. Referrals and refunds will show up here.
                </AppText>
              ) : (
                wallet?.transactions.map((txn, index) => {
                  const credit = txn.amount >= 0;
                  return (
                    <View
                      key={txn.id}
                      style={[
                        styles.txnRow,
                        index < (wallet?.transactions.length ?? 0) - 1 && styles.txnBorder,
                      ]}
                    >
                      <View
                        style={[
                          styles.txnIcon,
                          { backgroundColor: credit ? colors.primarySoft : colors.dangerSoft },
                        ]}
                      >
                        <Ionicons
                          name={credit ? 'arrow-down' : 'arrow-up'}
                          size={16}
                          color={credit ? colors.primaryDark : colors.danger}
                        />
                      </View>
                      <View style={{ flex: 1, gap: 1 }}>
                        <AppText variant="bodyMedium" numberOfLines={1}>
                          {txn.note ?? txn.type.replaceAll('_', ' ').toLowerCase()}
                        </AppText>
                        <AppText variant="caption" tone="muted">
                          {new Date(txn.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </AppText>
                      </View>
                      <AppText
                        variant="bodyMedium"
                        tone={credit ? 'primary' : 'danger'}
                        style={{ fontWeight: '700' }}
                      >
                        {credit ? '+' : ''}
                        {money(txn.amount)}
                      </AppText>
                    </View>
                  );
                })
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 14, paddingBottom: 30 },
  center: { alignItems: 'center', gap: 9, paddingVertical: 26 },
  balanceCard: { gap: 12 },
  balanceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  balanceIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyCard: { gap: 11 },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  perkList: { gap: 5 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  referralCard: { gap: 10 },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.primaryMuted,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.primarySoft,
  },
  applyButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  txnBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  txnIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
