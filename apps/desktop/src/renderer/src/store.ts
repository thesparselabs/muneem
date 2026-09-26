import { create } from 'zustand';
import type { Session, SyncStatus } from '@muneem/contracts';

/** Transient UI state only. Server-state semantics live in TanStack Query. */
interface UiState {
  session: Session | null | undefined; // undefined = not loaded yet
  sync: SyncStatus | null;
  online: boolean;
  setSession: (s: Session | null) => void;
  setSync: (s: SyncStatus) => void;
  setOnline: (o: boolean) => void;
}
export const useUi = create<UiState>((set) => ({
  session: undefined, sync: null, online: false,
  setSession: (session) => set({ session }),
  setSync: (sync) => set({ sync }),
  setOnline: (online) => set({ online }),
}));
