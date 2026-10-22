import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@/constants/design';
import { formatAddress } from '@/lib/format';
import type { Address } from '@/lib/types';
import { AppText } from './ui/AppText';
import { Badge, IconButton } from './ui/Badge';

type Props = {
  address: Address;
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSetDefault?: () => void;
  showActions?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AddressCard({
  address,
  selected = false,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  showActions = false,
  style,
}: Props) {
  const content = (
    <View style={[styles.card, selected && styles.selected, style]}>
      <View style={styles.top}>
        <View style={styles.labelIcon}>
          <Ionicons
            name={address.label.toLowerCase() === 'work' ? 'briefcase-outline' : 'home-outline'}
            size={17}
            color={colors.primaryDark}
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.labelRow}>
            <AppText variant="bodyMedium" style={{ fontWeight: '700' }}>
              {address.label}
            </AppText>
            {address.isDefault ? <Badge label="Default" tone="green" /> : null}
          </View>
          <AppText variant="meta" tone="muted" numberOfLines={2}>
            {formatAddress(address)}
          </AppText>
        </View>
        {selected ? (
          <View style={styles.check}>
            <Ionicons name="checkmark" size={14} color={colors.white} />
          </View>
        ) : null}
      </View>
      {showActions ? (
        <View style={styles.actions}>
          {!address.isDefault && onSetDefault ? (
            <Pressable onPress={onSetDefault} style={styles.actionLink} hitSlop={6}>
              <Ionicons name="star-outline" size={14} color={colors.primaryDark} />
              <AppText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
                Set default
              </AppText>
            </Pressable>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <View style={styles.iconActions}>
            {onEdit ? (
              <IconButton
                icon="create-outline"
                onPress={onEdit}
                accessibilityLabel={`Edit ${address.label} address`}
                size={34}
              />
            ) : null}
            {onDelete ? (
              <IconButton
                icon="trash-outline"
                onPress={onDelete}
                accessibilityLabel={`Delete ${address.label} address`}
                size={34}
                color={colors.danger}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );

  if (!onSelect) return content;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${address.label}, ${formatAddress(address)}`}
      onPress={onSelect}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  selected: { borderColor: colors.primary, backgroundColor: '#FCFFFD' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  labelIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  check: {
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 9,
  },
  actionLink: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  iconActions: { flexDirection: 'row', gap: 8 },
});
