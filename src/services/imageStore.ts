// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { create } from "zustand";
import type { Alarm, NDArrayInfo, NumericArray, TimeStamp } from "@src/types/epicsWS";

/** One NTNDArray frame: the pixels and the metadata that belongs to them */
export interface ImageFrame {
  value: NumericArray;
  ndarray: NDArrayInfo;
  timeStamp: TimeStamp;
  alarm?: Alarm;
}

interface ImageStoreState {
  frames: Record<string, ImageFrame>;
  /** Whether the WebSocket is connected; frames are cleared when it is not */
  connected: boolean;
  setFrames: (updates: Record<string, ImageFrame>) => void;
  removeFrames: (pvNames: string[]) => void;
  clearFrames: () => void;
  setConnected: (connected: boolean) => void;
}

/**
 * Latest frame of every image (NTNDArray) PV. Frames are kept out of `usePVStore`, which only
 * holds a summary of these PVs, so they never reach React props, rules or macros. Consumers
 * subscribe imperatively (`useImageStore.subscribe`) rather than through a React selector.
 */
export const useImageStore = create<ImageStoreState>((set) => ({
  frames: {},
  connected: false,
  setFrames: (updates) => set((state) => ({ frames: { ...state.frames, ...updates } })),
  removeFrames: (pvNames) =>
    set((state) => {
      const next = { ...state.frames };
      for (const pv of pvNames) delete next[pv];
      return { frames: next };
    }),
  clearFrames: () => set({ frames: {} }),
  setConnected: (connected) => set(connected ? { connected } : { connected, frames: {} }),
}));
