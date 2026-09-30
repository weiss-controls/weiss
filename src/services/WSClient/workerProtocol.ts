// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { PVWriteValue, TimeStamp, WSMessage } from "@src/types/epicsWS";

export type SnapshotResult = Record<string, unknown>;

/** Main thread -> WS worker */
export type WorkerRequest =
  | { type: "open"; url: string }
  | { type: "subscribe"; pvs: string[] }
  | { type: "unsubscribe"; pvs: string[] }
  | { type: "write"; pv: string; value: PVWriteValue }
  | { type: "snapshot"; id: number }
  | { type: "restore"; id: number; pvs: Record<string, { value: PVWriteValue }> }
  | { type: "close" };

export type ScalarSample = [pv: string, timeStamp: TimeStamp, value: number];

/**
 * PV traffic accumulated by the worker during one flush interval.
 * `updates` holds the latest merged message per PV; `samples` holds every scalar
 * sample received so history buffers stay lossless. Apply `disconnected` first.
 */
export interface PVBatch {
  updates: Record<string, WSMessage>;
  disconnected: string[];
  samples: ScalarSample[];
}

/** WS worker -> main thread */
export type WorkerResponse =
  | { type: "connection"; connected: boolean }
  | ({ type: "batch" } & PVBatch)
  | { type: "rpcResult"; id: number; ok: true; data: SnapshotResult }
  | { type: "rpcResult"; id: number; ok: false; error: string };
