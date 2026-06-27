// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { create } from "zustand";
import type { PVData } from "@src/types/epicsWS";

interface PVStoreState {
  pvs: Record<string, PVData>;
  setPVs: (updates: Record<string, PVData>) => void;
  removePVs: (pvNames: string[]) => void;
  clearPVs: () => void;
}

/**
 * Module-level Zustand store for EPICS PV data.
 *
 * Writing PV updates here instead of React state means zero React re-renders
 * are triggered by PV ticks at the provider level. Consumers that call
 * `usePVStore` with a selector re-render only when the specific slice they
 * selected changes identity.
 *
 * Usage:
 *   // Reactive — re-renders only when this PV changes
 *   const pvData = usePVStore(state => state.pvs["MY:PV"]);
 *
 *   // Non-reactive read (e.g. inside an event handler)
 *   const snapshot = usePVStore.getState().pvs;
 */
export const usePVStore = create<PVStoreState>((set) => ({
  pvs: {},
  setPVs: (updates) =>
    set((state) => ({
      pvs: { ...state.pvs, ...updates },
    })),
  removePVs: (pvNames) =>
    set((state) => {
      const next = { ...state.pvs };
      for (const pv of pvNames) delete next[pv];
      return { pvs: next };
    }),
  clearPVs: () => set({ pvs: {} }),
}));
