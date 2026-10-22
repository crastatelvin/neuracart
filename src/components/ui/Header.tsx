import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, spacing } from '@/constants/design';
import { AppText } from './AppText';

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  variant = 'light',
  border = true,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  variant?: 'light' | 'green';
  border?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const green = variant === 'green';
  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + 10,
          backgroundColor: green ? colors.primary : colors.background,
          borderBottomColor: green ? 'transparent' : colors.border,
          borderBottomWidth: border ? 1 : 0,
        },
      ]}
    >
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack}
            hitSlop={8}
            style={({ pressed }) => [
              styles.back,
              green ? styles.backGreen : styles.backLight,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons
              name="arrow-back"
              size={21}
              color={green ? colors.white : colors.text}
            />
          </Pressable>
        ) : null}
        <View style={styles.titleBlock}>
          <AppText
            variant="section"
            numberOfLines={1}
            style={{ color: green ? colors.white : colors.text }}
          >
            {title}
          </AppText>
          {subtitle ? (
            <AppText
              variant="meta"
              numberOfLines={1}
              style={{ color: green ? 'rgba(255,255,255,0.78)' : colors.muted }}
            >
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.section}>
      <AppText variant="section">{title}</AppText>
      {action && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <AppText variant="meta" tone="primary" style={{ fontWeight: '700' }}>
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: layout.gutter,
    paddingBottom: spacing.md,
  },
  row: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLight: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  backGreen: { backgroundColor: 'rgba(255,255,255,0.18)' },
  titleBlock: { flex: 1, gap: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
});
