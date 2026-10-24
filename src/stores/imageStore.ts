// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { create } from "zustand";
import type { Alarm, NDArrayInfo, NumericArray, TimeStamp } from "@src/types/epicsWS";
import { usePVStore } from "@src/stores/pvStore";
import { isTypedNumericArray } from "@src/utils/numericArray";

/** Value of an image PV's summary in the PV store, and of a frame without pixels */
export const EMPTY_FRAME = new Uint8Array(0);

/** One image frame: the pixels and the metadata that belongs to them */
export interface ImageFrame {
  value: NumericArray;
  /** NTNDArray metadata; absent for plain array PVs registered as images */
  ndarray?: NDArrayInfo;
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
 * Dedicated store for image PVs (AreaDetector).
 * Holds the latest frame of every image PV.
 * Standard `usePVStore` only holds a summary of these PVs, without the pixels,
 * which keeps frames out of React props, rules and macros for performance reasons.
 */
export const useImageStore = create<ImageStoreState>((set) => ({
  frames: {},
  connected: false,
  setFrames: (updates) => set((state) => ({ frames: { ...state.frames, ...updates } })),
  removeFrames,
  clearFrames: () => set({ frames: {} }),
  setConnected: (connected) => set(connected ? { connected } : { connected, frames: {} }),
}));

function removeFrames(pvNames: string[]) {
  const next = { ...useImageStore.getState().frames };
  for (const pv of pvNames) delete next[pv];
  useImageStore.setState({ frames: next });
}

// Registration count per plain array PV (no NTNDArray metadata) shown as an image
const imagePVs = new Map<string, number>();

/** Whether updates of a plain array PV go to the image store instead of the PV store */
export function isImagePV(pv: string): boolean {
  return imagePVs.has(pv);
}

/** Plain array PVs currently registered as images */
export function registeredImagePVs(): string[] {
  return [...imagePVs.keys()];
}

/**
 * Treats a plain array PV as an image PV until the returned function is called: its frames go
 * to the image store, like NTNDArray frames. A value already in the PV store is moved there.
 */
export function registerImagePV(pv: string): () => void {
  const count = imagePVs.get(pv) ?? 0;
  imagePVs.set(pv, count + 1);
  if (count === 0) {
    const data = usePVStore.getState().pvs[pv];
    if (data && !data.ndarray && isTypedNumericArray(data.value) && data.value.length > 0) {
      const { value, timeStamp, alarm } = data;
      useImageStore.getState().setFrames({ [pv]: { value, timeStamp, alarm } });
      usePVStore.getState().setPVs({ [pv]: { ...data, value: EMPTY_FRAME } });
    }
  }
  let registered = true;
  return () => {
    if (!registered) return;
    registered = false;
    const remaining = (imagePVs.get(pv) ?? 1) - 1;
    if (remaining > 0) {
      imagePVs.set(pv, remaining);
      return;
    }
    imagePVs.delete(pv);
    useImageStore.getState().removeFrames([pv]);
  };
}
