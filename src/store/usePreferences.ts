'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PrefState {
  /** Right-swiped (liked) yacht ids — this is the wishlist. */
  likedIds: string[];
  /** Left-swiped (skipped) yacht ids. */
  skippedIds: string[];
  /** True once localStorage has rehydrated (guards SSR mismatch). */
  hydrated: boolean;

  like: (id: string) => void;
  skip: (id: string) => void;
  unsave: (id: string) => void;
  reset: () => void;
  setHydrated: () => void;
}

export const usePreferences = create<PrefState>()(
  persist(
    (set) => ({
      likedIds: [],
      skippedIds: [],
      hydrated: false,

      like: (id) =>
        set((s) =>
          s.likedIds.includes(id)
            ? s
            : { likedIds: [...s.likedIds, id], skippedIds: s.skippedIds.filter((x) => x !== id) },
        ),
      skip: (id) =>
        set((s) =>
          s.skippedIds.includes(id)
            ? s
            : { skippedIds: [...s.skippedIds, id], likedIds: s.likedIds.filter((x) => x !== id) },
        ),
      unsave: (id) => set((s) => ({ likedIds: s.likedIds.filter((x) => x !== id) })),
      reset: () => set({ likedIds: [], skippedIds: [] }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'yacht-tinder-prefs',
      partialize: (s) => ({ likedIds: s.likedIds, skippedIds: s.skippedIds }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
