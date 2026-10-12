// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { NDArrayInfo } from "@src/types/epicsWS";
import { resolveLayout } from "./worker/imageLayout.ts";
import { renderFrame } from "./worker/render.ts";

export const PREVIEW_SIZE = 256;

let preview: ImageData | null = null;

/** Deterministic stand-in image for edit mode, produced by the same code that renders live frames */
export function getPreviewImage(): ImageData {
  if (preview) return preview;

  const center = (PREVIEW_SIZE - 1) / 2;
  const value = new Uint8Array(PREVIEW_SIZE * PREVIEW_SIZE);
  for (let y = 0; y < PREVIEW_SIZE; y++) {
    for (let x = 0; x < PREVIEW_SIZE; x++) {
      const distance = Math.hypot(x - center, y - center);
      value[y * PREVIEW_SIZE + x] = Math.round(255 * Math.max(0, 1 - distance / 160));
    }
  }

  const dimension = {
    size: PREVIEW_SIZE,
    offset: 0,
    fullSize: PREVIEW_SIZE,
    binning: 1,
    reverse: false,
  };
  const info: NDArrayInfo = {
    dimension: [dimension, dimension],
    uniqueId: 0,
    codec: { name: "" },
    compressedSize: value.length,
    uncompressedSize: value.length,
    dataTimeStamp: { secondsPastEpoch: 0, nanoseconds: 0, userTag: 0 },
    colorMode: 0,
  };
  const result = resolveLayout(value, info);
  if (!result.ok) throw new Error(result.message);

  const image = new ImageData(PREVIEW_SIZE, PREVIEW_SIZE);
  renderFrame(result.pixels, result.layout, { scale: "linear", colorMap: "grayscale" }, image.data);
  preview = image;
  return image;
}
