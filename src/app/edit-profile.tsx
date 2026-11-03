import { colors, themedStyles } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { BottomBar } from '@/components/ui/BottomBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/Header';
import { TextField } from '@/components/ui/TextField';
import { apiErrorMessage } from '@/lib/api';
import { initials } from '@/lib/format';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';

const PHONE_PATTERN = /^\+?[1-9]\d{9,14}$/;

export default function EditProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const showToast = useToastStore((state) => state.show);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function validateName() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError('Name must be at least 2 characters');
      return false;
    }
    if (trimmed.length > 80) {
      setNameError('Name must be 80 characters or fewer');
      return false;
    }
    setNameError(null);
    return true;
  }

  function normalizePhone(value: string): string {
    return value.replace(/[\s()-]/g, '');
  }

  function validatePhone() {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setPhoneError(null);
      return true;
    }
    if (!PHONE_PATTERN.test(normalized)) {
      setPhoneError('Enter a valid phone number, e.g. +919876543210');
      return false;
    }
    setPhoneError(null);
    return true;
  }

  async function save() {
    const nameValid = validateName();
    const phoneValid = validatePhone();
    if (!nameValid || !phoneValid) return;
    setServerError(null);
    setSaving(true);
    try {
      const normalizedPhone = normalizePhone(phone);
      await updateProfile({
        name: name.trim(),
        ...(normalizedPhone && normalizedPhone !== normalizePhone(user?.phone ?? '')
          ? { phone: normalizedPhone }
          : {}),
      });
      showToast('Profile updated');
      router.back();
    } catch (caught) {
      setServerError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="auto" />
      <ScreenHeader
        title="Edit profile"
        subtitle="Keep your delivery details up to date"
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarBlock}>
          <View style={styles.avatar}>
            <AppText variant="title" tone="primary">
              {initials(user?.name, user?.email)}
            </AppText>
          </View>
          <View style={{ gap: 2, alignItems: 'center' }}>
            <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
              {user?.name || 'NeuraCart customer'}
            </AppText>
            <AppText variant="caption" tone="muted">
              Your profile details are private
            </AppText>
          </View>
        </View>

        {serverError ? (
          <View style={styles.serverError}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <AppText variant="meta" tone="danger" style={{ flex: 1 }}>
              {serverError}
            </AppText>
          </View>
        ) : null}

        <Card style={styles.formCard}>
          <TextField
            label="Full name"
            required
            icon="person-outline"
            placeholder="Your name"
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (nameError) setNameError(null);
            }}
            onBlur={validateName}
            error={nameError}
            autoCapitalize="words"
            textContentType="name"
            editable={!saving}
            maxLength={80}
          />
          <TextField
            label="Email address"
            icon="mail-outline"
            value={user?.email ?? ''}
            editable={false}
            hint="Email is used for sign-in and can’t be changed here."
          />
          <TextField
            label="Phone number"
            icon="call-outline"
            placeholder="+919876543210"
            value={phone}
            onChangeText={(value) => {
              setPhone(value);
              if (phoneError) setPhoneError(null);
            }}
            onBlur={validatePhone}
            error={phoneError}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            editable={!saving}
            maxLength={20}
            hint="Your rider may call this number if they need help finding you."
          />
        </Card>

        <View style={styles.privacyNote}>
          <Ionicons name="shield-checkmark-outline" size={17} color={colors.primaryDark} />
          <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
            We only use these details to deliver your orders and keep your account secure.
          </AppText>
        </View>
      </ScrollView>

      <BottomBar>
        <Button
          label="Save changes"
          onPress={save}
          loading={saving}
          icon="checkmark"
        />
      </BottomBar>
    </KeyboardAvoidingView>
  );
}

const styles = themedStyles((colors) => StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16, paddingBottom: 28 },
  avatarBlock: { alignItems: 'center', gap: 9, paddingVertical: 4 },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 28,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderRadius: 14,
    padding: 12,
  },
  formCard: { gap: 15 },
  privacyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingHorizontal: 2 },
}));
