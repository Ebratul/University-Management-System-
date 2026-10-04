import { create } from "zustand";

/**
 * Client-only UI state. Server data never lives here; it belongs to TanStack
 * Query. Keep this store small and free of anything that needs a request.
 */
type UiState = {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}));
