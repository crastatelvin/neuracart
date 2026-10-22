import { Platform } from 'react-native';

export const colors = {
  primary: '#16A34A',
  primaryDark: '#15803D',
  primaryDeep: '#14532D',
  primarySoft: '#F0FDF4',
  primaryMuted: '#DCFCE7',
  background: '#F9FAFB',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#4B5563',
  muted: '#6B7280',
  subtle: '#9CA3AF',
  border: '#F3F4F6',
  borderStrong: '#E5E7EB',
  input: '#F9FAFB',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  warning: '#D97706',
  warningSoft: '#FFFBEB',
  white: '#FFFFFF',
  overlay: 'rgba(17, 24, 39, 0.45)',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  pill: 999,
} as const;

export const fonts = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const shadows = Platform.select({
  ios: {
    card: {
      shadowColor: '#14532D',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
    },
    floating: {
      shadowColor: '#14532D',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
    },
  },
  android: {
    card: { elevation: 1 },
    floating: { elevation: 6 },
  },
  default: {
    card: {
      shadowColor: '#14532D',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
    },
    floating: {
      shadowColor: '#14532D',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
    },
  },
}) ?? { card: {}, floating: {} };

export const layout = {
  gutter: 20,
  maxContentWidth: 720,
  tabBarHeight: 62,
  buttonHeight: 52,
  inputHeight: 54,
} as const;
