import { colors, radius, themedStyles } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { BottomBar } from '@/components/ui/BottomBar';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/Header';
import { TextField } from '@/components/ui/TextField';
import { apiErrorMessage } from '@/lib/api';
import type { Address } from '@/lib/types';
import { useToastStore } from '@/store/toast';

export type AddressFormValues = {
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
};

type Props = {
  mode: 'add' | 'edit';
  address?: Address;
  onBack: () => void;
  onSubmit: (values: AddressFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
};

const LABELS = [
  { key: 'Home', icon: 'home-outline' },
  { key: 'Work', icon: 'briefcase-outline' },
  { key: 'Other', icon: 'location-outline' },
] as const;

type Errors = Partial<Record<keyof AddressFormValues, string>>;

function validate(values: AddressFormValues): Errors {
  const errors: Errors = {};
  if (!values.line1.trim()) errors.line1 = 'Address line 1 is required';
  else if (values.line1.trim().length < 5) errors.line1 = 'Add a little more detail';
  if (!values.city.trim()) errors.city = 'City is required';
  else if (values.city.trim().length < 2) errors.city = 'Enter a valid city';
  if (!values.state.trim()) errors.state = 'State is required';
  else if (values.state.trim().length < 2) errors.state = 'Enter a valid state';
  if (!/^\d{6}$/.test(values.pincode.trim())) errors.pincode = 'Enter a 6-digit PIN code';
  return errors;
}

export function AddressEditor({ mode, address, onBack, onSubmit, onDelete }: Props) {
  const showToast = useToastStore((state) => state.show);
  const [values, setValues] = useState<AddressFormValues>({
    label: address?.label || 'Home',
    line1: address?.line1 || '',
    line2: address?.line2 || '',
    city: address?.city || 'Bengaluru',
    state: address?.state || 'Karnataka',
    pincode: address?.pincode || '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function update<K extends keyof AddressFormValues>(field: K, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    if (serverError) setServerError(null);
  }

  function validateField(field: keyof AddressFormValues) {
    const fieldErrors = validate(values);
    if (fieldErrors[field]) {
      setErrors((current) => ({ ...current, [field]: fieldErrors[field] }));
    }
  }

  async function save() {
    const nextErrors = validate(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      await onSubmit({
        label: values.label,
        line1: values.line1.trim(),
        line2: values.line2.trim(),
        city: values.city.trim(),
        state: values.state.trim(),
        pincode: values.pincode.trim(),
      });
      showToast(mode === 'add' ? 'Address added' : 'Address updated');
    } catch (caught) {
      setServerError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!onDelete || deleting) return;
    Alert.alert(
      'Delete this address?',
      'If this is your default address, the next saved address will become the default.',
      [
        { text: 'Keep address', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setServerError(null);
            try {
              await onDelete();
              showToast('Address deleted', 'info');
            } catch (caught) {
              setServerError(apiErrorMessage(caught));
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="auto" />
      <ScreenHeader
        title={mode === 'add' ? 'Add address' : 'Edit address'}
        subtitle="We deliver across serviceable Bengaluru pincodes"
        onBack={onBack}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <AppText variant="section">Save as</AppText>
          <View style={styles.labelRow}>
            {LABELS.map((item) => {
              const selected = values.label === item.key;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Use label ${item.key}`}
                  onPress={() => update('label', item.key)}
                  style={({ pressed }) => [
                    styles.labelChip,
                    selected && styles.labelChipSelected,
                    pressed && { opacity: 0.78 },
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={17}
                    color={selected ? colors.white : colors.primaryDark}
                  />
                  <AppText
                    variant="meta"
                    style={{
                      color: selected ? colors.white : colors.textSecondary,
                      fontWeight: '700',
                    }}
                  >
                    {item.key}
                  </AppText>
                </Pressable>
              );
            })}
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

        <View style={styles.form}>
          <TextField
            label="Address line 1"
            required
            placeholder="House number, building and street"
            value={values.line1}
            onChangeText={(value) => update('line1', value)}
            onBlur={() => validateField('line1')}
            error={errors.line1}
            autoCapitalize="words"
            textContentType="streetAddressLine1"
            editable={!saving && !deleting}
            maxLength={120}
            icon="home-outline"
          />
          <TextField
            label="Address line 2"
            placeholder="Landmark, area (optional)"
            value={values.line2}
            onChangeText={(value) => update('line2', value)}
            autoCapitalize="words"
            textContentType="streetAddressLine2"
            editable={!saving && !deleting}
            maxLength={120}
            icon="navigate-outline"
          />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextField
                label="City"
                required
                placeholder="City"
                value={values.city}
                onChangeText={(value) => update('city', value)}
                onBlur={() => validateField('city')}
                error={errors.city}
                autoCapitalize="words"
                textContentType="addressCity"
                editable={!saving && !deleting}
                maxLength={60}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="State"
                required
                placeholder="State"
                value={values.state}
                onChangeText={(value) => update('state', value)}
                onBlur={() => validateField('state')}
                error={errors.state}
                autoCapitalize="words"
                textContentType="addressState"
                editable={!saving && !deleting}
                maxLength={60}
              />
            </View>
          </View>
          <TextField
            label="PIN code"
            required
            placeholder="6-digit PIN code"
            value={values.pincode}
            onChangeText={(value) => update('pincode', value.replace(/\D/g, '').slice(0, 6))}
            onBlur={() => validateField('pincode')}
            error={errors.pincode}
            keyboardType="number-pad"
            textContentType="postalCode"
            editable={!saving && !deleting}
            maxLength={6}
            icon="map-outline"
            hint="We’ll check that this pincode is within our delivery area."
          />
        </View>

        <View style={styles.locationRow}>
          <View style={styles.locationIcon}>
            <Ionicons name="locate-outline" size={19} color={colors.subtle} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <View style={styles.soonRow}>
              <AppText variant="meta" tone="subtle" style={{ fontWeight: '700' }}>
                Use my current location
              </AppText>
              <View style={styles.soonPill}>
                <AppText variant="caption" tone="muted" style={{ fontWeight: '700' }}>
                  Soon
                </AppText>
              </View>
            </View>
            <AppText variant="caption" tone="subtle">
              Pinpoint your door automatically in a future update.
            </AppText>
          </View>
        </View>

        {mode === 'edit' && onDelete ? (
          <Pressable
            onPress={confirmDelete}
            disabled={saving || deleting}
            accessibilityRole="button"
            accessibilityLabel="Delete this address"
            style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.65 }]}
          >
            <Ionicons name="trash-outline" size={17} color={colors.danger} />
            <AppText variant="meta" tone="danger" style={{ fontWeight: '700' }}>
              {deleting ? 'Deleting…' : 'Delete this address'}
            </AppText>
          </Pressable>
        ) : null}
      </ScrollView>

      <BottomBar>
        <Button
          label={mode === 'add' ? 'Save address' : 'Save changes'}
          onPress={save}
          loading={saving}
          disabled={deleting}
          icon="checkmark"
        />
      </BottomBar>
    </KeyboardAvoidingView>
  );
}

const styles = themedStyles((colors) => StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 20, paddingBottom: 28 },
  section: { gap: 10 },
  labelRow: { flexDirection: 'row', gap: 9 },
  labelChip: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  labelChipSelected: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  serverError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    padding: 12,
  },
  form: { gap: 15 },
  row: { flexDirection: 'row', gap: 10 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 13,
    opacity: 0.85,
  },
  locationIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  soonPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
}));
