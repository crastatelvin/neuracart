import { create } from 'zustand';

type ToastState = {
  message: string | null;
  tone: 'success' | 'error' | 'info';
  show: (message: string, tone?: ToastState['tone']) => void;
  hide: () => void;
};

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  tone: 'success',
  show: (message, tone = 'success') => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message, tone });
    hideTimer = setTimeout(() => set({ message: null }), 2600);
  },
  hide: () => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message: null });
  },
}));
