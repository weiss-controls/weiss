// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import type { NDArrayInfo } from "@src/types/epicsWS";
import { resolveLayout } from "./worker/imageLayout.ts";
import type { ColorMapName } from "./worker/colorMaps.ts";
import type { ScaleMode } from "./worker/intensity.ts";
import { type RenderResult, renderFrame } from "./worker/render.ts";

const WIDTH = 256;
const HEIGHT = 192;

export interface PreviewImage {
  canvas: HTMLCanvasElement;
  result: RenderResult;
}

const previews = new Map<string, PreviewImage>();

// An off-centre spot under an "F" in the top-left corner: no rotation or flip looks the same
function previewPixels(): Uint8Array {
  const value = new Uint8Array(WIDTH * HEIGHT);
  const spotX = WIDTH * 0.6;
  const spotY = HEIGHT * 0.55;
  const bar = (x0: number, y0: number, x1: number, y1: number, x: number, y: number) =>
    x >= x0 && x < x1 && y >= y0 && y < y1;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const letter =
        bar(16, 16, 30, 84, x, y) || bar(16, 16, 68, 30, x, y) || bar(16, 44, 56, 58, x, y);
      const distance = Math.hypot(x - spotX, y - spotY);
      value[y * WIDTH + x] = letter ? 255 : Math.round(200 * Math.max(0, 1 - distance / 110));
    }
  }
  return value;
}

/**
 * Deterministic stand-in image for edit mode, produced by the same code that renders live frames.
 * Fixed limits are not applied (they refer to the real data).
 */
export function getPreviewImage(colorMap: ColorMapName, scale: ScaleMode): PreviewImage {
  const key = `${colorMap} ${scale}`;
  const cached = previews.get(key);
  if (cached) return cached;

  const value = previewPixels();
  const dimension = (size: number) => ({
    size,
    offset: 0,
    fullSize: size,
    binning: 1,
    reverse: false,
  });
  const info: NDArrayInfo = {
    dimension: [dimension(WIDTH), dimension(HEIGHT)],
    uniqueId: 0,
    codec: { name: "" },
    compressedSize: value.length,
    uncompressedSize: value.length,
    dataTimeStamp: { secondsPastEpoch: 0, nanoseconds: 0, userTag: 0 },
    colorMode: 0,
  };
  const result = resolveLayout(value, info);
  if (!result.ok) throw new Error(result.message);

  const image = new ImageData(WIDTH, HEIGHT);
  const rendered = renderFrame(
    result.pixels,
    result.layout,
    { colorMap, scale, limits: "auto" },
    image.data,
  );
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create a 2D context");
  context.putImageData(image, 0, 0);
  const preview = { canvas, result: rendered };
  previews.set(key, preview);
  return preview;
}
