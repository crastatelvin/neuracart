import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { radius, shadows, themedStyles } from '@/constants/design';

/**
 * Bottom-confirmation used for every consequential rider action
 * (decline, start, complete, sign out). One primary action per screen rule.
 */
export function ConfirmAction({
  open,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Close dialog" style={styles.fill} onPress={onClose} />
        <View style={styles.sheet}>
          <AppText variant="section">{title}</AppText>
          <AppText variant="body" tone="muted" style={styles.description}>
            {description}
          </AppText>
          <View style={styles.row}>
            <Button
              label={confirmLabel}
              variant={tone === 'danger' ? 'danger' : 'primary'}
              loading={!!busy}
              disabled={!!busy}
              onPress={onConfirm}
              style={styles.grow}
            />
            <Button
              label="Go back"
              variant="ghost"
              disabled={!!busy}
              onPress={onClose}
              style={styles.grow}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles((colors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  fill: { flex: 1 },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: 20,
    paddingBottom: 28,
    gap: 10,
    ...shadows.floating,
  },
  description: { marginBottom: 6 },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  grow: { flex: 1 },
}));
