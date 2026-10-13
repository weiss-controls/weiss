// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { NumericArray } from "@src/types/epicsWS";
import { type ColorMapName, getColorTable } from "./colorMaps.ts";
import type { ImageLayout } from "./imageLayout.ts";
import {
  LEVELS,
  type Limits,
  type ScaleMode,
  computeLimits,
  levelOf,
  resolveMapping,
} from "./intensity.ts";

export interface RenderParams {
  scale: ScaleMode;
  colorMap: ColorMapName;
}

export const DEFAULT_RENDER_PARAMS: RenderParams = { scale: "linear", colorMap: "grayscale" };

export function sameRenderParams(a: RenderParams, b: RenderParams): boolean {
  return a.scale === b.scale && a.colorMap === b.colorMap;
}

export interface RenderResult {
  /** Limits the intensities were mapped over; null if the frame has no finite value */
  limits: Limits | null;
  /** Scale actually applied */
  scale: ScaleMode;
}

// Integer types of at most 16 bits have few distinct values: one table lookup per pixel replaces
// the intensity mapping. The offset makes signed values valid indexes.
function lookupOffset(value: NumericArray): number | undefined {
  if (value instanceof Uint8Array || value instanceof Uint16Array) return 0;
  if (value instanceof Int8Array) return 128;
  if (value instanceof Int16Array) return 32768;
  return undefined;
}

// Scratch tables reused across frames
const colorLut = new Uint32Array(65536);
const levelLut = new Uint8Array(65536);

function renderMono(
  value: NumericArray,
  layout: ImageLayout,
  params: RenderParams,
  out: Uint8ClampedArray,
): RenderResult {
  const limits = computeLimits(value);
  const mapping = resolveMapping(limits, params.scale);
  const table = getColorTable(params.colorMap);
  // Whole-pixel copies through matching 32-bit views keep the RGBA byte order on any host
  const table32 = new Uint32Array(table.buffer, table.byteOffset, LEVELS);
  const out32 = new Uint32Array(out.buffer, out.byteOffset, layout.width * layout.height);
  const offset = lookupOffset(value);
  if (offset !== undefined && limits) {
    for (let v = limits.min; v <= limits.max; v++)
      colorLut[v + offset] = table32[levelOf(v, mapping)];
    for (let i = 0; i < out32.length; i++) out32[i] = colorLut[value[i] + offset];
  } else {
    for (let i = 0; i < out32.length; i++) {
      const level = levelOf(value[i], mapping);
      out32[i] = level < 0 ? 0 : table32[level]; // NaN stays transparent
    }
  }
  return { limits, scale: mapping.scale };
}

function renderRGB(
  value: NumericArray,
  layout: ImageLayout,
  params: RenderParams,
  out: Uint8ClampedArray,
): RenderResult {
  const { width, height, strideX, strideY, strideC } = layout;
  // 8-bit channels are shown as they are, other types are scaled over the frame limits
  const direct = value instanceof Uint8Array;
  const limits = direct ? { min: 0, max: LEVELS - 1 } : computeLimits(value);
  const mapping = resolveMapping(limits, params.scale);
  const offset = direct ? undefined : lookupOffset(value);
  if (offset !== undefined && limits) {
    for (let v = limits.min; v <= limits.max; v++) levelLut[v + offset] = levelOf(v, mapping);
  }
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
  return { limits, scale: direct ? "linear" : mapping.scale };
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
    : renderRGB(value, layout, params, out);
}
