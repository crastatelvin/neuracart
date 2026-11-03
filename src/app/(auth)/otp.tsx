import { colors, radius, shadows, themedStyles } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/AppText';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';

export default function OtpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string; devOtp?: string }>();
  const email = String(params.email ?? '');
  const verifyOtp = useAuthStore((state) => state.verifyOtp);
  const sendOtp = useAuthStore((state) => state.sendOtp);
  const showToast = useToastStore((state) => state.show);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [devCode, setDevCode] = useState(String(params.devOtp ?? ''));
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const code = digits.join('');
  const canSubmit = code.length === 6 && !loading;

  function setCode(nextCode: string) {
    const clean = nextCode.replace(/\D/g, '').slice(0, 6);
    const next = Array.from({ length: 6 }, (_, index) => clean[index] ?? '');
    setDigits(next);
    if (error) setError(null);
    if (clean.length === 6) {
      inputs.current[5]?.blur();
    } else {
      inputs.current[Math.min(clean.length, 5)]?.focus();
    }
  }

  function handleChange(index: number, value: string) {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      if (error) setError(null);
      return;
    }
    if (clean.length > 1) {
      setCode(`${digits.slice(0, index).join('')}${clean}`);
      return;
    }
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (error) setError(null);
    if (index < 5) inputs.current[index + 1]?.focus();
  }

  function handleKeyPress(index: number, key: string) {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputs.current[index - 1]?.focus();
    }
  }

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(email, code);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Signed in. Fresh finds await!');
      router.replace('/(tabs)');
    } catch (caught) {
      setError(apiErrorMessage(caught));
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (seconds > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const result = await sendOtp(email);
      setDevCode(result.devOtp ?? '');
      setSeconds(60);
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
      showToast('A new code is on its way');
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setResending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="auto" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 14 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change email"
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.65 }]}
        >
          <Ionicons name="arrow-back" size={21} color={colors.text} />
        </Pressable>

        <View style={styles.brandRow}>
          <BrandMark size={46} />
          <View style={{ flex: 1 }} />
          <View style={styles.securePill}>
            <Ionicons name="lock-closed" size={11} color={colors.primaryDark} />
            <AppText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
              Secure sign in
            </AppText>
          </View>
        </View>

        <View style={styles.heading}>
          <AppText variant="title">Check your inbox</AppText>
          <AppText variant="body" tone="muted">
            Enter the 6-digit code we sent to
          </AppText>
          <Pressable onPress={() => router.back()} hitSlop={4}>
            <AppText variant="bodyMedium" tone="primary" style={{ fontWeight: '700' }}>
              {email}
            </AppText>
          </Pressable>
        </View>

        <View style={styles.otpRow}>
          {digits.map((digit, index) => (
            <TextInput
              key={index}
              ref={(node) => {
                inputs.current[index] = node;
              }}
              value={digit}
              onChangeText={(value) => handleChange(index, value)}
              onKeyPress={(event) => handleKeyPress(index, event.nativeEvent.key)}
              keyboardType="number-pad"
              textContentType={index === 0 ? 'oneTimeCode' : 'none'}
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={6}
              autoFocus={index === 0}
              selectTextOnFocus
              caretHidden
              accessibilityLabel={`Digit ${index + 1}`}
              style={[styles.otpBox, !!error && styles.otpBoxError, digit && styles.otpBoxFilled]}
            />
          ))}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <AppText variant="meta" tone="danger" style={{ flex: 1 }}>
              {error}
            </AppText>
          </View>
        ) : null}

        <Button
          label="Verify & continue"
          onPress={submit}
          disabled={!canSubmit}
          loading={loading}
          iconRight="arrow-forward"
        />

        <View style={styles.resendRow}>
          <AppText variant="body" tone="muted">
            Didn’t get the code?{' '}
          </AppText>
          {seconds > 0 ? (
            <AppText variant="bodyMedium" tone="subtle">
              Resend in {seconds}s
            </AppText>
          ) : (
            <Pressable onPress={resend} disabled={resending} hitSlop={6}>
              <AppText variant="bodyMedium" tone="primary" style={{ fontWeight: '700' }}>
                {resending ? 'Sending…' : 'Resend code'}
              </AppText>
            </Pressable>
          )}
        </View>

        {devCode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use development OTP"
            onPress={() => setCode(devCode)}
            style={({ pressed }) => [styles.devCard, pressed && { opacity: 0.78 }]}
          >
            <Ionicons name="construct-outline" size={19} color={colors.warning} />
            <View style={{ flex: 1, gap: 1 }}>
              <AppText variant="meta" style={{ fontWeight: '700' }}>
                Development code
              </AppText>
              <AppText variant="caption" tone="muted">
                Email delivery is disabled locally. Tap to use {devCode}.
              </AppText>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.subtle} />
          </Pressable>
        ) : null}

        <AppText variant="caption" tone="subtle" style={styles.expiry}>
          The code expires in 10 minutes. Never share it with anyone.
        </AppText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = themedStyles((colors) => StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 30, gap: 22 },
  back: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  securePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  heading: { gap: 7, marginTop: 8 },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 7,
    marginVertical: 2,
  },
  otpBox: {
    flex: 1,
    maxWidth: 54,
    height: 62,
    borderRadius: 15,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    outlineWidth: 0,
    ...shadows.card,
  },
  otpBoxFilled: { borderColor: colors.primary, backgroundColor: '#FCFFFD' },
  otpBoxError: { borderColor: colors.danger },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: 12,
    marginTop: -6,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: -4,
  },
  devCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.md,
    padding: 12,
    marginTop: 'auto',
  },
  expiry: { textAlign: 'center', lineHeight: 16 },
}));
