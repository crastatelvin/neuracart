import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { isLanguage } from '@/lib/i18n';
import type { Language } from '@/lib/i18n';

const STORAGE_KEY = 'localmart.language';

type LanguageState = {
  language: Language;
  ready: boolean;
  /** True when this device already holds an explicit choice; server prefs must not override it. */
  hasLocal: boolean;
  hydrate: () => Promise<void>;
  setLanguage: (language: Language) => void;
};

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'en',
  ready: false,
  hasLocal: false,
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (isLanguage(stored)) set({ language: stored, hasLocal: true });
    } catch {
      // A missing preference simply means English.
    } finally {
      set({ ready: true });
    }
  },
  setLanguage: (language) => {
    set({ language, hasLocal: true });
    void AsyncStorage.setItem(STORAGE_KEY, language).catch(() => undefined);
  },
}));

/** Apply a language saved on the server without overwriting it with the device value. */
export function applyServerLanguage(value: string | null | undefined) {
  if (!isLanguage(value)) return;
  const state = useLanguageStore.getState();
  if (state.hasLocal) return;
  if (state.language !== value) {
    useLanguageStore.getState().setLanguage(value);
  }
}
