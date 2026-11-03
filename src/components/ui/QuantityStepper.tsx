import { colors, radius, themedStyles } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';

export function QuantityStepper({
  quantity,
  onIncrement,
  onDecrement,
  max = 99,
  compact = false,
}: {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  max?: number;
  compact?: boolean;
}) {
  const size = compact ? 29 : 38;
  return (
    <View style={[styles.stepper, compact && styles.stepperCompact]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        onPress={onDecrement}
        hitSlop={6}
        style={({ pressed }) => [
          styles.control,
          { width: size, height: size },
          pressed && { opacity: 0.55 },
        ]}
      >
        <Ionicons name="remove" size={compact ? 14 : 18} color={colors.primaryDark} />
      </Pressable>
      <AppText
        variant="bodyMedium"
        style={[styles.quantity, { minWidth: compact ? 18 : 24, fontWeight: '700' }]}
      >
        {quantity}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        accessibilityState={{ disabled: quantity >= max }}
        onPress={onIncrement}
        disabled={quantity >= max}
        hitSlop={6}
        style={({ pressed }) => [
          styles.control,
          { width: size, height: size },
          quantity >= max && { opacity: 0.35 },
          pressed && { opacity: 0.55 },
        ]}
      >
        <Ionicons name="add" size={compact ? 14 : 18} color={colors.primaryDark} />
      </Pressable>
    </View>
  );
}

const styles = themedStyles((colors) => StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  stepperCompact: { padding: 2 },
  control: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  quantity: { textAlign: 'center', color: colors.primaryDeep },
}));
