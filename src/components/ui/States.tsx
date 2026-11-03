import { colors, radius, spacing, themedStyles } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import type { IconName } from './types';

export function EmptyState({
  icon = 'basket-outline',
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.illustration}>
        <Ionicons name={icon} size={38} color={colors.primary} />
      </View>
      <AppText variant="section" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="body" tone="muted" style={styles.description}>
        {description}
      </AppText>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          fullWidth={false}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={[styles.illustration, styles.errorIllustration]}>
        <Ionicons name="cloud-offline-outline" size={36} color={colors.danger} />
      </View>
      <AppText variant="section" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="body" tone="muted" style={styles.description}>
        {description}
      </AppText>
      <Button
        label="Try again"
        onPress={onRetry}
        icon="refresh"
        variant="secondary"
        fullWidth={false}
        style={styles.action}
      />
    </View>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <AppText variant="meta" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: object;
}) {
  return (
    <View
      style={[
        { width, height, borderRadius, backgroundColor: colors.borderStrong, opacity: 0.55 },
        style,
      ]}
    />
  );
}

export function ProductGridSkeleton() {
  return (
    <View style={styles.grid}>
      {Array.from({ length: 6 }).map((_, index) => (
        <View key={index} style={styles.skeletonCard}>
          <Skeleton height={124} borderRadius={radius.lg} />
          <Skeleton height={14} width="80%" />
          <Skeleton height={11} width="48%" />
          <Skeleton height={28} width="55%" />
        </View>
      ))}
    </View>
  );
}

const styles = themedStyles((colors) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  illustration: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  errorIllustration: { backgroundColor: colors.dangerSoft },
  title: { textAlign: 'center' },
  description: { textAlign: 'center', maxWidth: 300 },
  action: { marginTop: 8, alignSelf: 'center' },
  loading: { paddingVertical: 44, alignItems: 'center', gap: 12 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  skeletonCard: {
    width: '47.8%',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 10,
    gap: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
}));
