import { Appearance, Platform, StyleSheet } from 'react-native';

export const lightColors = {
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
};

export type ThemeColors = typeof lightColors;
export type ThemeScheme = 'light' | 'dark';

export const darkColors: ThemeColors = {
  ...lightColors,
  primary: '#22C55E',
  primaryDark: '#4ADE80',
  primaryDeep: '#14532D',
  primarySoft: '#0C2318',
  primaryMuted: '#12301F',
  background: '#0B1220',
  card: '#111A2B',
  text: '#F3F4F6',
  textSecondary: '#CBD5E1',
  muted: '#94A3B8',
  subtle: '#64748B',
  border: '#1B2536',
  borderStrong: '#243044',
  input: '#0E1626',
  danger: '#F87171',
  dangerSoft: '#2A1013',
  warning: '#FBBF24',
  warningSoft: '#2A1D07',
  white: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

let activeScheme: ThemeScheme =
  Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

export function setActiveScheme(scheme: ThemeScheme): void {
  activeScheme = scheme;
}

export function activeColors(): ThemeColors {
  return activeScheme === 'dark' ? darkColors : lightColors;
}

/**
 * `colors` stays a drop-in replacement for the old palette: every read resolves
 * against the active scheme, so inline `colors.x` usages follow the theme as
 * soon as the screen re-renders.
 */
export const colors: ThemeColors = new Proxy({} as ThemeColors, {
  get: (_target, key) => activeColors()[key as keyof ThemeColors],
  has: (_target, key) => key in lightColors,
  ownKeys: () => Object.keys(lightColors),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

/**
 * Builds a StyleSheet per scheme and hands back a proxy, so module-level
 * `styles = StyleSheet.create(...)` keeps working unchanged while switching.
 */
export function themedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: ThemeColors) => T,
): T {
  const cache = new Map<ThemeScheme, T>();
  const sheet = (): T => {
    const cached = cache.get(activeScheme);
    if (cached) return cached;
    const created = factory(activeColors());
    cache.set(activeScheme, created);
    return created;
  };

  return new Proxy({} as T, {
    get: (_target, key) => sheet()[key as keyof T],
    has: (_target, key) => key in sheet(),
    ownKeys: () => Reflect.ownKeys(sheet()),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
}

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
