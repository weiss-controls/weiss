// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { NDArrayInfo, NumericArray } from "@src/types/epicsWS";
import type { RejectCode } from "./worker/imageLayout.ts";
import type { Limits, ScaleMode } from "./worker/intensity.ts";
import type { Orientation, ViewState } from "./viewport.ts";

/** Latest view of the image; sizes are in CSS pixels */
export interface ViewMessage {
  type: "view";
  width: number;
  height: number;
  pixelRatio: number;
  orientation: Orientation;
  state: ViewState;
}

/**
 * Messages between the AreaDetector controller and its worker. Frame-related ones carry the
 * configuration epoch they belong to, and messages from an older epoch are dropped. `view` has
 * no epoch: it never invalidates the image, and the last one received applies.
 */
export type MainToWorker =
  | { type: "init"; epoch: number; canvas: OffscreenCanvas }
  | ViewMessage
  /** Starts a new epoch and clears the canvas, e.g. when the PV changes */
  | { type: "reset"; epoch: number }
  | { type: "frame"; epoch: number; uniqueId: number; info: NDArrayInfo; value: NumericArray }
  | { type: "dispose" };

export interface FrameStats {
  uniqueId: number;
  width: number;
  height: number;
  /** Limits the intensities were mapped over */
  limits: Limits | null;
  scale: ScaleMode;
  processMs: number;
}

export type WorkerToMain =
  /** The frame is on screen; the next frame may be sent */
  | ({ type: "displayed"; epoch: number } & FrameStats)
  /** The frame was refused; the canvas was cleared and the next frame may be sent */
  | { type: "rejected"; epoch: number; uniqueId: number; code: RejectCode; message: string }
  | { type: "error"; epoch: number; message: string };
