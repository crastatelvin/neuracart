import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, shadows, spacing } from '@/constants/design';

export function BottomBar({
  children,
  floating = false,
}: {
  children: ReactNode;
  floating?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, 10) + 4 },
        floating && styles.floating,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
  },
  floating: {
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    ...shadows.floating,
  },
});
