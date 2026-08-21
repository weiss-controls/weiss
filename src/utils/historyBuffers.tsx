// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { TimeStamp } from "@src/types/epicsWS";

/** A single scalar sample: epoch-millis timestamp + value. */
export type ScalarPoint = [number, number];

export const toEpochMillis = (ts: TimeStamp): number =>
  ts.secondsPastEpoch * 1000 + Math.trunc(ts.nanoseconds / 1_000_000);

/**
 * Ring buffers of scalar PV history, keyed by PV name.
 * Buffering only happens for PVs a widget has explicitly registered interest in
 * via `registerPVHistory`. This is mostly used by plot widgets reading from scalar
 * PVs, which need to accumulate a history of samples for rendering.
 */
const historyBuffers: Record<string, ScalarPoint[]> = {};
/** Requested buffer sizes per PV, keyed by subscriber token; capacity is the max across all subscribers. */
const historySubscribers: Record<string, Map<symbol, number>> = {};

function recomputeBufCapacity(pv: string): void {
  const subs = historySubscribers[pv];
  if (!subs || subs.size === 0) {
    delete historyBuffers[pv];
    delete historySubscribers[pv];
    return;
  }
  const capacity = Math.max(...subs.values());
  const buf = historyBuffers[pv];
  if (buf && buf.length > capacity) historyBuffers[pv] = buf.slice(-capacity);
}

/**
 * Registers interest in buffering a PV's scalar history, up to `bufferSize` samples.
 * Returns an unregister function that must be called on cleanup (e.g. widget unmount).
 * Multiple subscribers to the same PV are supported; the buffer capacity is the
 * largest `bufferSize` requested by any current subscriber.
 */
export function registerPVHistory(pv: string, bufferSize: number): () => void {
  const token = Symbol();
  const subs = historySubscribers[pv] ?? (historySubscribers[pv] = new Map());
  subs.set(token, bufferSize);
  historyBuffers[pv] ??= [];
  recomputeBufCapacity(pv);
  return () => {
    subs.delete(token);
    recomputeBufCapacity(pv);
  };
}

/** Appends a scalar sample to a PV's history buffer, if any widget has registered interest in it. */
export function pushPVHistory(pv: string, timeStamp: TimeStamp, value: number): void {
  const subs = historySubscribers[pv];
  if (!subs || subs.size === 0) return;
  const capacity = Math.max(...subs.values());
  const buf = historyBuffers[pv] ?? (historyBuffers[pv] = []);
  buf.push([toEpochMillis(timeStamp), value]);
  if (buf.length > capacity) buf.shift();
}

/** Returns the current history buffer for a PV (empty array if none recorded). */
export function getPVHistory(pv: string): ScalarPoint[] {
  return historyBuffers[pv] ?? [];
}

/** Clears buffered samples for the given PVs, or all PVs when omitted (subscriptions are left intact). */
export function clearPVHistory(pvNames?: string[]): void {
  if (!pvNames) {
    for (const key of Object.keys(historyBuffers)) historyBuffers[key] = [];
    return;
  }
  for (const pv of pvNames) if (pv in historyBuffers) historyBuffers[pv] = [];
}
