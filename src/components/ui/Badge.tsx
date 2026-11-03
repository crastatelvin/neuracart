import { colors, radius, themedStyles } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import type { IconName } from './types';

export function Badge({
  label,
  tone = 'green',
  icon,
}: {
  label: string;
  tone?: 'green' | 'amber' | 'blue' | 'gray' | 'red' | 'purple';
  icon?: IconName;
}) {
  const palette = {
    green: { bg: colors.primarySoft, text: colors.primaryDark },
    amber: { bg: '#FFFBEB', text: '#B45309' },
    blue: { bg: '#EFF6FF', text: '#1D4ED8' },
    gray: { bg: colors.border, text: colors.muted },
    red: { bg: colors.dangerSoft, text: colors.danger },
    purple: { bg: '#FAF5FF', text: '#7E22CE' },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={palette.text} /> : null}
      <AppText variant="caption" style={{ color: palette.text, fontWeight: '700' }}>
        {label}
      </AppText>
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 40,
  color = colors.text,
  backgroundColor = colors.white,
  border = true,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  border?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          borderWidth: border ? 1 : 0,
        },
        pressed && { opacity: 0.72 },
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={color} />
    </Pressable>
  );
}

const styles = themedStyles((colors) => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.border,
  },
}));
