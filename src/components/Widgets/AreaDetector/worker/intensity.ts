// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { NumericArray } from "@src/types/epicsWS";

export type ScaleMode = "linear" | "log";

export interface Limits {
  min: number;
  max: number;
}

/** Number of intensity levels, matching the color table size */
export const LEVELS = 256;

/** Finite min/max of the array, or null if it has no finite value */
export function computeLimits(value: NumericArray): Limits | null {
  let min = Infinity;
  let max = -Infinity;
  if (value instanceof Float32Array || value instanceof Float64Array) {
    for (const v of value) {
      if (v - v !== 0) continue; // NaN and +/-Infinity
      if (v < min) min = v;
      if (v > max) max = v;
    }
  } else {
    for (const v of value) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return min <= max ? { min, max } : null;
}

/** Limits and scale turned into constants for per-pixel mapping */
export interface Mapping {
  /** Scale actually applied; a log request over a non-positive range falls back to linear */
  scale: ScaleMode;
  min: number;
  max: number;
  /** All finite values are equal (or there are none) */
  constant: boolean;
  minHalf: number;
  logMin: number;
  factor: number;
}

export function resolveMapping(limits: Limits | null, requested: ScaleMode): Mapping {
  const { min, max } = limits ?? { min: 0, max: 0 };
  const constant = !(max > min);
  const scale: ScaleMode = requested === "log" && min > 0 && !constant ? "log" : "linear";
  const logMin = scale === "log" ? Math.log(min) : 0;
  // Halving keeps a float64 range wider than the largest double from overflowing
  const minHalf = min * 0.5;
  const factor = constant
    ? 0
    : scale === "log"
      ? (LEVELS - 1) / (Math.log(max) - logMin)
      : (LEVELS - 1) / (max * 0.5 - minHalf);
  return { scale, min, max, constant, minHalf, logMin, factor };
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
