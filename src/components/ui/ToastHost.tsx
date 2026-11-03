import { colors, radius, shadows, themedStyles } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { useToastStore } from '@/store/toast';
import { AppText } from './AppText';

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const message = useToastStore((state) => state.message);
  const tone = useToastStore((state) => state.tone);
  if (!message) return null;
  const palette = {
    success: { bg: colors.primaryDeep, icon: 'checkmark-circle' as const },
    error: { bg: '#7F1D1D', icon: 'alert-circle' as const },
    info: { bg: '#1F2937', icon: 'information-circle' as const },
  }[tone];
  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 78 }]}
    >
      <View style={[styles.toast, { backgroundColor: palette.bg }]}>
        <Ionicons name={palette.icon} size={18} color={colors.white} />
        <AppText variant="bodyMedium" tone="white" style={styles.text}>
          {message}
        </AppText>
      </View>
    </View>
  );
}

const styles = themedStyles((colors) => StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, alignItems: 'center', zIndex: 100 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.pill,
    maxWidth: 440,
    ...shadows.floating,
  },
  text: { flexShrink: 1 },
}));
