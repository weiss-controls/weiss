// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { type ImageFrame, useImageStore } from "@src/services/imageStore";
import { usePVStore } from "@src/services/pvStore";

export type Unsubscribe = () => void;

export type FrameEvent =
  | { kind: "frame"; frame: ImageFrame }
  /** The PV delivers data, but not images (e.g. a waveform) */
  | { kind: "notImage" }
  | { kind: "waiting" }
  | { kind: "disconnected" };

/**
 * Where the controller gets its frames from. Delivers the current state right away and again
 * whenever it changes.
 */
export type FrameSource = (pv: string, onEvent: (event: FrameEvent) => void) => Unsubscribe;

function currentEvent(pv: string): FrameEvent {
  const { frames, connected } = useImageStore.getState();
  const frame = frames[pv];
  if (frame) return { kind: "frame", frame };
  if (!connected) return { kind: "disconnected" };
  // Image PVs only have a summary in the PV store, marked by `ndarray`
  const data = usePVStore.getState().pvs[pv];
  return data && !data.ndarray ? { kind: "notImage" } : { kind: "waiting" };
}

function sameEvent(a: FrameEvent, b: FrameEvent): boolean {
  if (a.kind === "frame" && b.kind === "frame") return a.frame === b.frame;
  return a.kind === b.kind;
}

/** Frames from the image store; the PV store only tells whether the PV is an image at all */
export const storeFrameSource: FrameSource = (pv, onEvent) => {
  let last = currentEvent(pv);
  onEvent(last);
  const update = () => {
    const next = currentEvent(pv);
    if (sameEvent(last, next)) return;
    last = next;
    onEvent(next);
  };
  const unsubscribeImages = useImageStore.subscribe(update);
  const unsubscribePVs = usePVStore.subscribe(update);
  return () => {
    unsubscribeImages();
    unsubscribePVs();
  };
};
