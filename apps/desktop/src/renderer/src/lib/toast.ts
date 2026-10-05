import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';
export interface Toast { id: number; message: string; variant: ToastVariant; }

interface ToastState {
  toasts: Toast[];
  push: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (message, variant = 'info') => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
