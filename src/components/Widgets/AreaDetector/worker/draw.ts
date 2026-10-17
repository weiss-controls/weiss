// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { type Orientation, type Size, type ViewState, resolveView } from "../viewport.ts";

// Only interfaces defined by both the DOM and the WebWorker type libraries
type DrawContext = CanvasDrawImage &
  CanvasImageSmoothing &
  CanvasRect &
  CanvasTransform & { readonly canvas: { width: number; height: number } };

/** Clears the context's canvas and draws `source` on it as seen through the view */
export function drawView(
  context: DrawContext,
  source: CanvasImageSource & Size,
  view: Size,
  orientation: Orientation,
  state: ViewState,
) {
  const { width, height } = context.canvas;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  const resolved = resolveView(view, source, orientation, state);
  if (!resolved || width === 0 || height === 0) return;

  // The canvas may be rounded away from view size times pixel ratio
  const sx = width / view.width;
  const sy = height / view.height;
  const [a, b, c, d, e, f] = resolved.matrix;
  context.setTransform(a * sx, b * sy, c * sx, d * sy, e * sx, f * sy);
  const smooth = resolved.scale * Math.min(sx, sy) < 1;
  context.imageSmoothingEnabled = smooth;
  if (smooth) context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0);
  context.setTransform(1, 0, 0, 1, 0, 0);
}
