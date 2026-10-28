import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AppText } from '@/components/ui/AppText';
import { colors, radius, shadows } from '@/constants/design';
import { apiErrorMessage, apiRequest } from '@/lib/api';
import { useToastStore } from '@/store/toast';

type Prefs = {
  dietTags: string[];
  householdSize: number | null;
  language: string;
  pushEnabled: boolean;
  greenBags: boolean;
};

const DIET_OPTIONS: { tag: string; label: string; icon: string }[] = [
  { tag: 'VEGETARIAN', label: 'Vegetarian', icon: 'leaf-outline' },
  { tag: 'VEGAN', label: 'Vegan', icon: 'flower-outline' },
  { tag: 'NO_MEAT', label: 'No meat', icon: 'fish-outline' },
  { tag: 'NO_PORK', label: 'No pork', icon: 'ban-outline' },
  { tag: 'NO_BEEF', label: 'No beef', icon: 'ban-outline' },
  { tag: 'JAIN', label: 'Jain friendly', icon: 'sparkles-outline' },
];

const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'hi', label: 'हिन्दी' },
];

export default function DietaryPreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((state) => state.show);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPrefs(await apiRequest<Prefs>('/auth/me/prefs'));
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function save() {
    if (!prefs || saving) return;
    setSaving(true);
    try {
      const updated = await apiRequest<Prefs>('/auth/me/prefs', {
        method: 'PATCH',
        body: {
          dietTags: prefs.dietTags,
          householdSize: prefs.householdSize ?? undefined,
          language: prefs.language,
          pushEnabled: prefs.pushEnabled,
          greenBags: prefs.greenBags,
        },
      });
      setPrefs(updated);
      showToast('Preferences saved');
      router.back();
    } catch (caught) {
      showToast(apiErrorMessage(caught), 'error');
    } finally {
      setSaving(false);
    }
  }

  function toggleTag(tag: string) {
    if (!prefs) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPrefs({
      ...prefs,
      dietTags: prefs.dietTags.includes(tag)
        ? prefs.dietTags.filter((item) => item !== tag)
        : [...prefs.dietTags, tag],
    });
  }

  return (
    <View style={styles.fill}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader title="Dietary preferences" onBack={() => router.back()} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <Card style={styles.loadingCard}>
            <AppText variant="body" tone="muted">
              Loading your preferences…
            </AppText>
          </Card>
        ) : error || !prefs ? (
          <Card style={styles.loadingCard}>
            <AppText variant="body" tone="muted">
              {error ?? 'Preferences are unavailable right now.'}
            </AppText>
            <Button label="Try again" onPress={() => void load()} variant="secondary" />
          </Card>
        ) : (
          <>
            <View style={styles.section}>
              <AppText variant="caption" tone="muted" style={styles.sectionLabel}>
                DIETARY NEEDS
              </AppText>
              <Card style={styles.sectionCard}>
                <AppText variant="meta" tone="muted">
                  We use these to personalise your home feed and smart search.
                </AppText>
                <View style={styles.chipWrap}>
                  {DIET_OPTIONS.map((option) => {
                    const active = prefs.dietTags.includes(option.tag);
                    return (
                      <Pressable
                        key={option.tag}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${active ? 'Remove' : 'Add'} ${option.label}`}
                        onPress={() => toggleTag(option.tag)}
                        style={({ pressed }) => [
                          styles.chip,
                          active && styles.chipActive,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Ionicons
                          name={option.icon as never}
                          size={15}
                          color={active ? colors.white : colors.primaryDark}
                        />
                        <AppText style={{ color: active ? colors.white : colors.text, fontWeight: '600' }}>
                          {option.label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            </View>

            <View style={styles.section}>
              <AppText variant="caption" tone="muted" style={styles.sectionLabel}>
                HOUSEHOLD
              </AppText>
              <Card style={[styles.sectionCard, styles.rowCard]}>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium" style={{ fontWeight: '600' }}>
                    People at home
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    Helps us predict how much you actually need
                  </AppText>
                </View>
                <View style={styles.stepper}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Fewer people"
                    onPress={() =>
                      setPrefs({
                        ...prefs,
                        householdSize: Math.max(1, (prefs.householdSize ?? 2) - 1),
                      })
                    }
                    hitSlop={8}
                  >
                    <Ionicons name="remove" size={16} color={colors.white} />
                  </Pressable>
                  <AppText style={styles.stepperValue}>
                    {prefs.householdSize ?? 2}
                  </AppText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="More people"
                    onPress={() =>
                      setPrefs({
                        ...prefs,
                        householdSize: Math.min(20, (prefs.householdSize ?? 2) + 1),
                      })
                    }
                    hitSlop={8}
                  >
                    <Ionicons name="add" size={16} color={colors.white} />
                  </Pressable>
                </View>
              </Card>
            </View>

            <View style={styles.section}>
              <AppText variant="caption" tone="muted" style={styles.sectionLabel}>
                APP LANGUAGE
              </AppText>
              <Card style={styles.sectionCard}>
                <View style={styles.chipWrap}>
                  {LANGUAGES.map((language) => {
                    const active = prefs.language === language.code;
                    return (
                      <Pressable
                        key={language.code}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Use ${language.label}`}
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setPrefs({ ...prefs, language: language.code });
                        }}
                        style={({ pressed }) => [
                          styles.chip,
                          active && styles.chipActive,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <AppText style={{ color: active ? colors.white : colors.text, fontWeight: '600' }}>
                          {language.label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
                <AppText variant="meta" tone="subtle">
                  More languages ship with every release.
                </AppText>
              </Card>
            </View>

            <View style={styles.section}>
              <AppText variant="caption" tone="muted" style={styles.sectionLabel}>
                GREEN DEFAULTS
              </AppText>
              <Card style={[styles.sectionCard, styles.rowCard]}>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium" style={{ fontWeight: '600' }}>
                    Reusable bags
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    Rider brings your order in a cloth bag and swaps it back
                  </AppText>
                </View>
                <Switch
                  value={prefs.greenBags}
                  onValueChange={(value) => setPrefs({ ...prefs, greenBags: value })}
                  trackColor={{ false: colors.borderStrong, true: colors.primaryMuted }}
                  thumbColor={colors.white}
                />
              </Card>
            </View>

            <Button
              label={saving ? 'Saving…' : 'Save preferences'}
              onPress={() => void save()}
              loading={saving}
              style={styles.saveButton}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 18 },
  loadingCard: { gap: 12 },
  section: { gap: 8 },
  sectionLabel: { letterSpacing: 1.1, fontWeight: '700' },
  sectionCard: { gap: 12, ...shadows.card },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  stepperValue: { color: colors.white, fontSize: 15, fontWeight: '800', minWidth: 18, textAlign: 'center' },
  saveButton: { marginTop: 4 },
});
