// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { usePVStore } from "@src/services/pvStore";
import type { PVData } from "@src/types/epicsWS";

export type Unsubscribe = () => void;

/**
 * Where the controller gets its frames from. Delivers the current data right away and again
 * whenever it changes, with `undefined` once the PV is gone (e.g. after a disconnect).
 */
export type FrameSource = (pv: string, onData: (data: PVData | undefined) => void) => Unsubscribe;

export const pvStoreFrameSource: FrameSource = (pv, onData) => {
  onData(usePVStore.getState().pvs[pv]);
  return usePVStore.subscribe((state, previous) => {
    const data = state.pvs[pv];
    if (data !== previous.pvs[pv]) onData(data);
  });
};
