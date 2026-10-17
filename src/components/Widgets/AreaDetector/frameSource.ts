// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { type ImageFrame, registerImagePV, useImageStore } from "@src/services/imageStore";
import { usePVStore } from "@src/services/pvStore";
import type { PVData } from "@src/types/epicsWS";
import type { WaveformShape } from "./worker/imageLayout.ts";

export type Unsubscribe = () => void;

/** PVs giving the shape of a plain waveform image; waveform mode needs both sizes */
export interface ShapePVs {
  sizeX?: string;
  sizeY?: string;
  dataType?: string;
}

/** The configured shape, and when any part of it last changed (`performance.now()`) */
export interface TrackedShape extends WaveformShape {
  changedAt: number;
}

export type FrameEvent =
  /** `shape` is set in waveform mode; NTNDArray frames carry their own shape */
  | { kind: "frame"; frame: ImageFrame; shape?: TrackedShape }
  /** The PV delivers data, but not images (e.g. a waveform without size PVs) */
  | { kind: "notImage" }
  | { kind: "waiting" }
  | { kind: "disconnected" };

/**
 * Where the controller gets its frames from. Delivers the current state right away and again
 * whenever it changes.
 */
export type FrameSource = (
  pv: string,
  shapePVs: ShapePVs,
  onEvent: (event: FrameEvent) => void,
) => Unsubscribe;

export function isWaveformMode(shapePVs: ShapePVs): boolean {
  return !!shapePVs.sizeX && !!shapePVs.sizeY;
}

function numberOf(data: PVData | undefined): number | undefined {
  return typeof data?.value === "number" ? data.value : undefined;
}

// DataType_RBV is an enum: its value is the choice index (or the name, if sent as text)
function enumNameOf(data: PVData | undefined): string | undefined {
  const value = data?.value;
  if (typeof value === "string") return value;
  return typeof value === "number" ? data?.enumChoices?.[value] : undefined;
}

function sameEvent(a: FrameEvent, b: FrameEvent): boolean {
  if (a.kind === "frame" && b.kind === "frame") return a.frame === b.frame;
  return a.kind === b.kind;
}

/** Frames from the image store; the PV store gives the waveform shape and tells non-images apart */
export const storeFrameSource: FrameSource = (pv, shapePVs, onEvent) => {
  const waveform = isWaveformMode(shapePVs);
  // Plain waveforms are registered as image PVs; NTNDArray PVs are detected by their metadata
  const unregister = waveform ? registerImagePV(pv) : undefined;

  let shape: TrackedShape | undefined;
  const readShape = () => {
    if (!waveform) return;
    const pvs = usePVStore.getState().pvs;
    const next = {
      sizeX: numberOf(shapePVs.sizeX ? pvs[shapePVs.sizeX] : undefined),
      sizeY: numberOf(shapePVs.sizeY ? pvs[shapePVs.sizeY] : undefined),
      dataType: enumNameOf(shapePVs.dataType ? pvs[shapePVs.dataType] : undefined),
    };
    if (
      !shape ||
      shape.sizeX !== next.sizeX ||
      shape.sizeY !== next.sizeY ||
      shape.dataType !== next.dataType
    ) {
      shape = { ...next, changedAt: performance.now() };
    }
  };

  const currentEvent = (): FrameEvent => {
    const { frames, connected } = useImageStore.getState();
    const frame = frames[pv];
    if (frame) return { kind: "frame", frame, shape };
    if (!connected) return { kind: "disconnected" };
    // Image PVs only have a summary in the PV store, marked by `ndarray` (or by registration)
    const data = usePVStore.getState().pvs[pv];
    return data && !data.ndarray && !waveform ? { kind: "notImage" } : { kind: "waiting" };
  };

  readShape();
  let last = currentEvent();
  onEvent(last);
  const update = () => {
    readShape();
    const next = currentEvent();
    if (sameEvent(last, next)) return;
    last = next;
    onEvent(next);
  };
  const unsubscribeImages = useImageStore.subscribe(update);
  const unsubscribePVs = usePVStore.subscribe(update);
  return () => {
    unsubscribeImages();
    unsubscribePVs();
    unregister?.();
  };
};
