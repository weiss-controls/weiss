// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import type { NumericArray } from "@src/types/epicsWS";

export type ScaleMode = "linear" | "log";

export interface Limits {
  min: number;
  max: number;
}

/** Where the applied limits came from; `autoFallback` means the fixed ones were invalid */
export type LimitsMode = "auto" | "fixed" | "autoFallback";

/** Finite range of a frame */
export interface DataRange extends Limits {
  /** Smallest finite value above zero, or null if there is none or it was not requested */
  minPositive: number | null;
}

/** Number of intensity levels, matching the color table size */
export const LEVELS = 256;

/** Finite min/max of the array (and the smallest positive value if asked), or null if it has no finite value */
export function computeLimits(value: NumericArray, positive = false): DataRange | null {
  let min = Infinity;
  let max = -Infinity;
  let minPositive = Infinity;
  const float = value instanceof Float32Array || value instanceof Float64Array;
  // Separate loops keep the common cases free of extra checks
  if (float && positive) {
    // oxlint-disable-next-line typescript/prefer-for-of -- indexed loops are ~5x faster than for...of on typed arrays
    for (let i = 0; i < value.length; i++) {
      const v = value[i];
      if (v - v !== 0) continue; // NaN and +/-Infinity
      if (v < min) min = v;
      if (v > max) max = v;
      if (v > 0 && v < minPositive) minPositive = v;
    }
  } else if (float) {
    // oxlint-disable-next-line typescript/prefer-for-of -- see above
    for (let i = 0; i < value.length; i++) {
      const v = value[i];
      if (v - v !== 0) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  } else if (positive) {
    // oxlint-disable-next-line typescript/prefer-for-of -- see above
    for (let i = 0; i < value.length; i++) {
      const v = value[i];
      if (v < min) min = v;
      if (v > max) max = v;
      if (v > 0 && v < minPositive) minPositive = v;
    }
  } else {
    // oxlint-disable-next-line typescript/prefer-for-of -- see above
    for (let i = 0; i < value.length; i++) {
      const v = value[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!(min <= max)) return null;
  return { min, max, minPositive: minPositive === Infinity ? null : minPositive };
}

/** Fixed limits that can be used as they are, or null */
export function validFixedLimits(limits: "auto" | Limits): Limits | null {
  if (limits === "auto") return null;
  const { min, max } = limits;
  return Number.isFinite(min) && Number.isFinite(max) && min < max ? limits : null;
}

export interface MappingRequest {
  scale: ScaleMode;
  limits: "auto" | Limits;
}

/** Limits and scale turned into constants for per-pixel mapping */
export interface Mapping {
  /** Scale actually applied; log falls back to linear without a positive range */
  scale: ScaleMode;
  min: number;
  max: number;
  limitsMode: LimitsMode;
  /** The range is empty (all finite values equal, or none) */
  constant: boolean;
  minHalf: number;
  logMin: number;
  factor: number;
}

/**
 * `range` is the frame's range, needed unless valid fixed limits are requested. Automatic log
 * limits start at the smallest positive value; values at or below it get the lowest level.
 */
export function resolveMapping(range: DataRange | null, request: MappingRequest): Mapping {
  const fixed = validFixedLimits(request.limits);
  const limitsMode: LimitsMode = fixed
    ? "fixed"
    : request.limits === "auto"
      ? "auto"
      : "autoFallback";
  const limits = fixed ?? range ?? { min: 0, max: 0 };
  const { max } = limits;
  let { min } = limits;
  let scale: ScaleMode = "linear";
  if (request.scale === "log") {
    if (fixed) {
      if (min > 0) scale = "log";
    } else if (range?.minPositive != null && range.minPositive < max) {
      min = range.minPositive;
      scale = "log";
    }
  }
  const constant = !(max > min);
  const logMin = scale === "log" ? Math.log(min) : 0;
  // Halving keeps a float64 range wider than the largest double from overflowing
  const minHalf = min * 0.5;
  const factor = constant
    ? 0
    : scale === "log"
      ? (LEVELS - 1) / (Math.log(max) - logMin)
      : (LEVELS - 1) / (max * 0.5 - minHalf);
  return { scale, min, max, limitsMode, constant, minHalf, logMin, factor };
}

/** Intensity level 0..255 of a value, or -1 for NaN. Infinities clamp to the ends. */
export function levelOf(v: number, m: Mapping): number {
  if (v !== v) return -1;
  if (m.constant || v <= m.min) return 0;
  if (v >= m.max) return LEVELS - 1;
  const t =
    m.scale === "log" ? (Math.log(v) - m.logMin) * m.factor : (v * 0.5 - m.minHalf) * m.factor;
  return t | 0;
}
