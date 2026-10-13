// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { NumericArray } from "@src/types/epicsWS";
import { type ColorMapName, getColorTable } from "./colorMaps.ts";
import type { ImageLayout } from "./imageLayout.ts";
import {
  LEVELS,
  type Limits,
  type LimitsMode,
  type Mapping,
  type ScaleMode,
  computeLimits,
  levelOf,
  resolveMapping,
  validFixedLimits,
} from "./intensity.ts";

export interface RenderParams {
  scale: ScaleMode;
  colorMap: ColorMapName;
  /** Mono only; RGB always uses automatic limits on a linear scale */
  limits: "auto" | Limits;
}

export const DEFAULT_RENDER_PARAMS: RenderParams = {
  scale: "linear",
  colorMap: "grayscale",
  limits: "auto",
};

/** Rendering parameters from widget properties */
export function toRenderParams(
  colorMap: ColorMapName,
  autoLimits: unknown,
  min: unknown,
  max: unknown,
  log: unknown,
): RenderParams {
  return {
    scale: log === true ? "log" : "linear",
    colorMap,
    limits: autoLimits === false ? { min: Number(min), max: Number(max) } : "auto",
  };
}

export function sameRenderParams(a: RenderParams, b: RenderParams): boolean {
  const sameLimits =
    a.limits === "auto" || b.limits === "auto"
      ? a.limits === b.limits
      : a.limits.min === b.limits.min && a.limits.max === b.limits.max;
  return a.scale === b.scale && a.colorMap === b.colorMap && sameLimits;
}

export interface RenderResult {
  /** Limits the intensities were mapped over; null if they come from a frame without finite values */
  limits: Limits | null;
  /** Scale actually applied */
  scale: ScaleMode;
  limitsMode: LimitsMode;
}

// Integer types of at most 16 bits have few distinct values: one table lookup per pixel replaces
// the intensity mapping. The offset makes signed values valid indexes.
function lookupRange(value: NumericArray): { offset: number; size: number } | undefined {
  if (value instanceof Uint8Array) return { offset: 0, size: 256 };
  if (value instanceof Int8Array) return { offset: 128, size: 256 };
  if (value instanceof Uint16Array) return { offset: 0, size: 65536 };
  if (value instanceof Int16Array) return { offset: 32768, size: 65536 };
  return undefined;
}

// Scratch tables reused across frames
const colorLut = new Uint32Array(65536);
const levelLut = new Uint8Array(65536);

// What colorLut currently holds. It covers the whole type range, so a fixed mapping is built once
// and no entry is left over from a previous frame's range.
let colorLutKey = "";

function resultOf(mapping: Mapping, hasRange: boolean): RenderResult {
  return {
    limits:
      hasRange || mapping.limitsMode === "fixed" ? { min: mapping.min, max: mapping.max } : null,
    scale: mapping.scale,
    limitsMode: mapping.limitsMode,
  };
}

function renderMono(
  value: NumericArray,
  layout: ImageLayout,
  params: RenderParams,
  out: Uint8ClampedArray,
): RenderResult {
  // Valid fixed limits need no pass over the frame
  const range = validFixedLimits(params.limits)
    ? null
    : computeLimits(value, params.scale === "log");
  const mapping = resolveMapping(range, params);
  const table = getColorTable(params.colorMap);
  // Whole-pixel copies through matching 32-bit views keep the RGBA byte order on any host
  const table32 = new Uint32Array(table.buffer, table.byteOffset, LEVELS);
  const out32 = new Uint32Array(out.buffer, out.byteOffset, layout.width * layout.height);
  const lookup = lookupRange(value);
  if (lookup) {
    const { offset, size } = lookup;
    const key = `${params.colorMap} ${offset} ${size} ${mapping.scale} ${mapping.min} ${mapping.max}`;
    if (key !== colorLutKey) {
      for (let i = 0; i < size; i++) colorLut[i] = table32[levelOf(i - offset, mapping)];
      colorLutKey = key;
    }
    for (let i = 0; i < out32.length; i++) out32[i] = colorLut[value[i] + offset];
  } else {
    for (let i = 0; i < out32.length; i++) {
      const level = levelOf(value[i], mapping);
      out32[i] = level < 0 ? 0 : table32[level]; // NaN stays transparent
    }
  }
  return resultOf(mapping, range !== null);
}

function renderRGB(value: NumericArray, layout: ImageLayout, out: Uint8ClampedArray): RenderResult {
  const { width, height, strideX, strideY, strideC } = layout;
  // 8-bit channels are shown as they are, other types are scaled over the frame limits
  const direct = value instanceof Uint8Array;
  const range = direct ? { min: 0, max: LEVELS - 1, minPositive: null } : computeLimits(value);
  const mapping = resolveMapping(range, { scale: "linear", limits: "auto" });
  const lookup = direct ? undefined : lookupRange(value);
  if (lookup && range) {
    for (let v = range.min; v <= range.max; v++) levelLut[v + lookup.offset] = levelOf(v, mapping);
  }
  const offset = lookup?.offset;
  const channel = (v: number) =>
    direct ? v : offset !== undefined ? levelLut[v + offset] : Math.max(levelOf(v, mapping), 0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const source = y * strideY + x * strideX;
      const target = (y * width + x) * 4;
      out[target] = channel(value[source]);
      out[target + 1] = channel(value[source + strideC]);
      out[target + 2] = channel(value[source + 2 * strideC]);
      out[target + 3] = 255;
    }
  }
  return resultOf(mapping, range !== null);
}

/** Writes the RGBA pixels of a validated frame into `out`, which must hold width * height * 4 bytes. */
export function renderFrame(
  value: NumericArray,
  layout: ImageLayout,
  params: RenderParams,
  out: Uint8ClampedArray,
): RenderResult {
  if (out.length !== layout.width * layout.height * 4 || out.byteOffset % 4 !== 0) {
    throw new Error("Output buffer does not match the frame");
  }
  return layout.kind === "mono"
    ? renderMono(value, layout, params, out)
    : renderRGB(value, layout, out);
}
