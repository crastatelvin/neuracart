import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/constants/design';
import { AppText } from './AppText';

export function BrandMark({
  size = 64,
  showWordmark = false,
  light = false,
}: {
  size?: number;
  showWordmark?: boolean;
  light?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.mark,
          {
            width: size,
            height: size,
            borderRadius: size * 0.3,
            backgroundColor: light ? colors.white : colors.primary,
          },
        ]}
      >
        <Ionicons
          name="leaf"
          size={size * 0.48}
          color={light ? colors.primary : colors.white}
        />
      </View>
      {showWordmark ? (
        <View>
          <AppText
            variant="title"
            style={{ color: light ? colors.white : colors.primaryDeep, letterSpacing: -0.8 }}
          >
            LocalMart
          </AppText>
          <AppText
            variant="caption"
            style={{ color: light ? 'rgba(255,255,255,0.8)' : colors.muted }}
          >
            Your neighbourhood market
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mark: { alignItems: 'center', justifyContent: 'center' },
});
