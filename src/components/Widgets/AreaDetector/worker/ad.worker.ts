// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { MainToWorker, ViewMessage, WorkerToMain } from "../workerProtocol.ts";
import { drawView } from "./draw.ts";
import { resolveLayout } from "./imageLayout.ts";
import { type RenderParams, renderFrame } from "./render.ts";

// Intensity controls arrive later; until then every frame uses these defaults
const PARAMS: RenderParams = { scale: "linear", colorMap: "grayscale" };

let epoch = 0;
let canvas: OffscreenCanvas | null = null;
let context: OffscreenCanvasRenderingContext2D | null = null;
let view: ViewMessage | null = null;
// Reused while the frame size stays the same
let imageData: ImageData | null = null;
// The last processed frame, redrawn whenever the view changes
let image: OffscreenCanvas | null = null;
let imageContext: OffscreenCanvasRenderingContext2D | null = null;
let hasImage = false;

function post(message: WorkerToMain) {
  postMessage(message);
}

function fail(error: unknown) {
  post({ type: "error", epoch, message: error instanceof Error ? error.message : String(error) });
}

function present() {
  if (!canvas || !context) return;
  if (hasImage && image && view) {
    drawView(context, image, view, view.orientation, view.state);
  } else {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/** Forgets the image too, so a later view change cannot bring it back */
function clear() {
  hasImage = false;
  present();
}

function handleView(message: ViewMessage) {
  view = message;
  if (canvas) {
    // Resizing clears the canvas; it is redrawn right away
    const width = Math.round(message.width * message.pixelRatio);
    const height = Math.round(message.height * message.pixelRatio);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }
  present();
}

function handleFrame(message: Extract<MainToWorker, { type: "frame" }>) {
  if (message.epoch !== epoch) return;
  const start = performance.now();

  const result = resolveLayout(message.value, message.info);
  if (!result.ok) {
    clear();
    post({
      type: "rejected",
      epoch,
      uniqueId: message.uniqueId,
      code: result.code,
      message: result.message,
    });
    return;
  }

  const { layout, pixels } = result;
  if (!imageData || imageData.width !== layout.width || imageData.height !== layout.height) {
    imageData = new ImageData(layout.width, layout.height);
  }
  const stats = renderFrame(pixels, layout, PARAMS, imageData.data);
  const frame = {
    uniqueId: message.uniqueId,
    width: layout.width,
    height: layout.height,
    ...stats,
  };

  if (!image || !imageContext) {
    image = new OffscreenCanvas(layout.width, layout.height);
    imageContext = image.getContext("2d");
    if (!imageContext) throw new Error("Could not create a 2D context");
  }
  if (image.width !== layout.width) image.width = layout.width;
  if (image.height !== layout.height) image.height = layout.height;
  imageContext.putImageData(imageData, 0, 0);
  hasImage = true;
  present();
  post({ type: "displayed", epoch, ...frame, processMs: performance.now() - start });
}

self.onmessage = (event: MessageEvent<MainToWorker>) => {
  const message = event.data;
  try {
    switch (message.type) {
      case "init":
        epoch = message.epoch;
        canvas = message.canvas;
        context = canvas.getContext("2d");
        if (!context) throw new Error("Could not create a 2D context");
        break;
      case "view":
        handleView(message);
        break;
      case "reset":
        epoch = message.epoch;
        clear();
        break;
      case "frame":
        handleFrame(message);
        break;
      case "dispose":
        self.close();
        break;
    }
  } catch (error) {
    fail(error);
  }
};
