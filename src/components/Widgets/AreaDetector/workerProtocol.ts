// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { NDArrayInfo, NumericArray } from "@src/types/epicsWS";
import type { RejectCode } from "./worker/imageLayout.ts";
import type { Limits, LimitsMode, ScaleMode } from "./worker/intensity.ts";
import type { Orientation, ViewState } from "./viewport.ts";
import type { RenderParams } from "./worker/render.ts";

/** Latest view of the image; sizes are in CSS pixels */
export interface ViewMessage {
  type: "view";
  width: number;
  height: number;
  pixelRatio: number;
  orientation: Orientation;
  state: ViewState;
}

/** Intensity rendering parameters; the retained frame is re-rendered with them */
export interface ParamsMessage {
  type: "params";
  params: RenderParams;
}

/**
 * Messages between the AreaDetector controller and its worker. Frame-related ones carry the
 * controller's `resetCount`, the number of times the displayed image has been discarded, and
 * messages with an older count are dropped. `view` and `params` have none: they never
 * invalidate the image, and the last one received applies.
 */
export type MainToWorker =
  | { type: "init"; resetCount: number; canvas: OffscreenCanvas }
  | ViewMessage
  | ParamsMessage
  /** Discards the image and everything sent for it, e.g. when the PV changes */
  | { type: "reset"; resetCount: number }
  | { type: "frame"; resetCount: number; uniqueId: number; info: NDArrayInfo; value: NumericArray }
  | { type: "dispose" };

export interface FrameStats {
  uniqueId: number;
  width: number;
  height: number;
  /** Limits the intensities were mapped over */
  limits: Limits | null;
  scale: ScaleMode;
  limitsMode: LimitsMode;
  processMs: number;
}

export type WorkerToMain =
  /** The frame is on screen; the next frame may be sent */
  | ({ type: "displayed"; resetCount: number } & FrameStats)
  /** The retained frame was re-rendered after a `params` message; delivery is not affected */
  | ({ type: "rendered"; resetCount: number } & FrameStats)
  /** The frame was refused; the canvas was cleared and the next frame may be sent */
  | { type: "rejected"; resetCount: number; uniqueId: number; code: RejectCode; message: string }
  | { type: "error"; resetCount: number; message: string };
