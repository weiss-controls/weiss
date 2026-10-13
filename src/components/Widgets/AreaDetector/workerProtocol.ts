// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { NDArrayInfo, NumericArray } from "@src/types/epicsWS";
import type { RejectCode } from "./worker/imageLayout.ts";
import type { Limits, ScaleMode } from "./worker/intensity.ts";

/**
 * Messages between the AreaDetector controller and its worker. Each one carries the
 * configuration epoch it belongs to, and messages from an older epoch are dropped.
 */
export type MainToWorker =
  | { type: "init"; epoch: number; canvas: OffscreenCanvas }
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
