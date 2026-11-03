import { setActiveScheme, type ThemeScheme } from '@/constants/design';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'neuracart.theme';

type ThemeState = {
  mode: ThemeMode;
  hydrated: boolean;
  setMode: (mode: ThemeMode) => void;
  hydrate: () => Promise<void>;
};

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  hydrated: false,
  setMode: (mode) => {
    set({ mode });
    void AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => undefined);
  },
  hydrate: async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    const mode: ThemeMode =
      stored === 'light' || stored === 'dark' || stored === 'system'
        ? stored
        : 'system';
    set({ mode, hydrated: true });
  },
}));

/**
 * Resolves the effective scheme and publishes it to the palette proxy before
 * the tree renders. The root layout re-renders on every change, so screens see
 * the new colours on the same pass.
 */
export function useResolvedScheme(): ThemeScheme {
  const mode = useThemeStore((state) => state.mode);
  const system = useColorScheme();
  const scheme: ThemeScheme =
    mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  setActiveScheme(scheme);
  return scheme;
}

export function useThemeHydrated(): void {
  const hydrate = useThemeStore((state) => state.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
}
