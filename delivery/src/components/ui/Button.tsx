import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, themedStyles } from '@/constants/design';
import { AppText } from './AppText';
import type { IconName } from './types';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'light';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = true,
  size = 'md',
  style,
  accessibilityLabel,
}: Props) {
  const inactive = disabled || loading;
  const onColor = variant === 'primary' || variant === 'danger' ? colors.white : colors.primaryDark;
  const textColor: Record<Variant, string> = {
    primary: colors.white,
    secondary: colors.primaryDark,
    ghost: colors.primaryDark,
    danger: colors.white,
    light: colors.white,
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.small,
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        inactive && styles.disabled,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={onColor}
        />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <Ionicons
              name={icon}
              size={size === 'sm' ? 16 : 19}
              color={textColor[variant]}
            />
          ) : null}
          <AppText
            variant="button"
            style={[
              styles.label,
              size === 'sm' && styles.smallLabel,
              { color: textColor[variant] },
            ]}
          >
            {label}
          </AppText>
          {iconRight ? (
            <Ionicons
              name={iconRight}
              size={size === 'sm' ? 16 : 19}
              color={textColor[variant]}
            />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const variantStyles = themedStyles((colors) => StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.danger },
  light: { backgroundColor: 'rgba(255,255,255,0.16)' },
}));

const styles = themedStyles((colors) => StyleSheet.create({
  base: {
    height: layout.buttonHeight,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  small: { height: 40, borderRadius: radius.sm, paddingHorizontal: 14 },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontFamily: undefined },
  smallLabel: { fontSize: 13 },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
}));
