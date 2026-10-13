// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { NDArrayInfo, NumericArray } from "@src/types/epicsWS";

// Provisional resource limits, to be tuned against real detectors
export const MAX_DIMENSION = 16384;
export const MAX_PIXELS = 32 * 1024 * 1024;

export type ImageKind = "mono" | "rgb1" | "rgb2" | "rgb3";

/**
 * Where each pixel component lives in the flat array, in elements.
 * Component c of pixel (x, y) is at `y * strideY + x * strideX + c * strideC`.
 */
export interface ImageLayout {
  kind: ImageKind;
  width: number;
  height: number;
  channels: 1 | 3;
  strideX: number;
  strideY: number;
  strideC: number;
}

export type RejectCode =
  | "notNDArray"
  | "compressed"
  | "emptyFrame"
  | "unsupportedColorMode"
  | "ambiguousColorMode"
  | "badLayout"
  | "badPayload"
  | "tooLarge";

export type LayoutResult =
  | { ok: true; layout: ImageLayout; pixels: NumericArray; info: NDArrayInfo }
  | { ok: false; code: RejectCode; message: string };

// areaDetector NDColorMode_t
const COLOR_MODE_MONO = 0;
const COLOR_MODE_BAYER = 1;
const COLOR_MODE_RGB1 = 2;
const COLOR_MODE_RGB2 = 3;
const COLOR_MODE_RGB3 = 4;
const COLOR_MODE_YUV_FIRST = 5;
const COLOR_MODE_YUV_LAST = 7;

export function asNumericArray(value: unknown): NumericArray | undefined {
  return ArrayBuffer.isView(value) && !(value instanceof DataView)
    ? (value as NumericArray)
    : undefined;
}

function reject(code: RejectCode, message: string): LayoutResult {
  return { ok: false, code, message };
}

/**
 * Validates a frame and works out its pixel layout without touching the pixels.
 * Dimension sizes are ordered fastest axis first: Mono [x, y], RGB1 [3, x, y],
 * RGB2 [x, 3, y], RGB3 [x, y, 3]. A frame is never interpreted unless every
 * check passes, so unsupported data cannot be mistaken for pixels.
 */
export function resolveLayout(value: unknown, info: NDArrayInfo | undefined): LayoutResult {
  if (!info) return reject("notNDArray", "PV is not an NTNDArray");
  if (info.codec.name !== "") {
    return reject("compressed", `Compressed frames (${info.codec.name}) are not supported yet`);
  }

  const pixels = asNumericArray(value);
  if (!pixels) return reject("badPayload", "Frame has no pixel data");
  if (pixels.length === 0) return reject("emptyFrame", "Frame is empty");

  const sizes = info.dimension.map((d) => d.size);
  const { colorMode } = info;

  let kind: ImageKind;
  if (colorMode === undefined) {
    if (sizes.length === 3) {
      return reject("ambiguousColorMode", "3D frame without a ColorMode attribute");
    }
    kind = "mono";
  } else if (colorMode === COLOR_MODE_MONO) {
    kind = "mono";
  } else if (colorMode === COLOR_MODE_RGB1) {
    kind = "rgb1";
  } else if (colorMode === COLOR_MODE_RGB2) {
    kind = "rgb2";
  } else if (colorMode === COLOR_MODE_RGB3) {
    kind = "rgb3";
  } else if (colorMode === COLOR_MODE_BAYER) {
    return reject("unsupportedColorMode", "Bayer color mode is not supported");
  } else if (colorMode >= COLOR_MODE_YUV_FIRST && colorMode <= COLOR_MODE_YUV_LAST) {
    return reject("unsupportedColorMode", "YUV color modes are not supported");
  } else {
    return reject("unsupportedColorMode", `Unknown color mode ${colorMode}`);
  }

  const mono = kind === "mono";
  if (sizes.length !== (mono ? 2 : 3)) {
    return reject(
      "badLayout",
      `${mono ? "Mono" : "RGB"} frame with ${sizes.length} dimensions is not supported`,
    );
  }
  if (sizes.some((size) => size < 1)) return reject("badLayout", "Frame has an empty dimension");

  let width: number;
  let height: number;
  let channelAxis = -1;
  if (kind === "rgb1") {
    [channelAxis, width, height] = [0, sizes[1], sizes[2]];
  } else if (kind === "rgb2") {
    [width, channelAxis, height] = [sizes[0], 1, sizes[2]];
  } else {
    [width, height] = [sizes[0], sizes[1]];
    if (kind === "rgb3") channelAxis = 2;
  }
  if (!mono && sizes[channelAxis] !== 3) {
    return reject("badLayout", `${kind.toUpperCase()} frame needs a channel axis of size 3`);
  }

  if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
    return reject("tooLarge", `Frame of ${width}x${height} pixels exceeds the supported size`);
  }

  const channels = mono ? 1 : 3;
  if (pixels.length !== width * height * channels) {
    return reject(
      "badPayload",
      `Frame has ${pixels.length} values but its dimensions need ${width * height * channels}`,
    );
  }

  const strides = {
    mono: { strideX: 1, strideY: width, strideC: 0 },
    rgb1: { strideX: 3, strideY: 3 * width, strideC: 1 },
    rgb2: { strideX: 1, strideY: 3 * width, strideC: width },
    rgb3: { strideX: 1, strideY: width, strideC: width * height },
  }[kind];
  return { ok: true, layout: { kind, width, height, channels, ...strides }, pixels, info };
}

/** Raw value(s) of pixel (x, y) of a validated frame: one for Mono, three for RGB */
export function pixelValue(
  pixels: NumericArray,
  layout: ImageLayout,
  x: number,
  y: number,
): number[] {
  const index = y * layout.strideY + x * layout.strideX;
  return Array.from({ length: layout.channels }, (_, c) => pixels[index + c * layout.strideC]);
}
