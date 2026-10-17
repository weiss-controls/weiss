// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type {
  FrameStats,
  MainToWorker,
  ParamsMessage,
  ViewMessage,
  WorkerToMain,
} from "../workerProtocol.ts";
import type { NumericArray } from "@src/types/epicsWS";
import { drawView } from "./draw.ts";
import { type ImageLayout, resolveLayout } from "./imageLayout.ts";
import { DEFAULT_RENDER_PARAMS, type RenderParams, renderFrame } from "./render.ts";

let resetCount = 0;
let canvas: OffscreenCanvas | null = null;
let context: OffscreenCanvasRenderingContext2D | null = null;
let view: ViewMessage | null = null;
let params: RenderParams = DEFAULT_RENDER_PARAMS;
// The last accepted frame, re-rendered when the parameters change
let frame: { uniqueId: number; layout: ImageLayout; pixels: NumericArray } | null = null;
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
  post({
    type: "error",
    resetCount,
    message: error instanceof Error ? error.message : String(error),
  });
}

function present() {
  if (!canvas || !context) return;
  if (hasImage && image && view) {
    drawView(context, image, view, view.orientation, view.state);
  } else {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/** Clears the canvas and drops the retained image and frame */
function clear() {
  hasImage = false;
  frame = null;
  present();
}

/** Renders the retained frame with the current parameters and puts it on screen */
function render(start: number): FrameStats {
  if (!frame) throw new Error("No frame to render");
  const { layout, pixels } = frame;
  if (!imageData || imageData.width !== layout.width || imageData.height !== layout.height) {
    imageData = new ImageData(layout.width, layout.height);
  }
  const stats = renderFrame(pixels, layout, params, imageData.data);

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
  return {
    uniqueId: frame.uniqueId,
    kind: layout.kind,
    width: layout.width,
    height: layout.height,
    ...stats,
    processMs: performance.now() - start,
  };
}

function handleParams(message: ParamsMessage) {
  params = message.params;
  if (!frame) return;
  post({ type: "rendered", resetCount, ...render(performance.now()) });
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
  if (message.resetCount !== resetCount) return;
  const start = performance.now();

  const result = resolveLayout(message.value, message.info);
  if (!result.ok) {
    clear();
    post({
      type: "rejected",
      resetCount,
      uniqueId: message.uniqueId,
      code: result.code,
      message: result.message,
    });
    return;
  }

  frame = { uniqueId: message.uniqueId, layout: result.layout, pixels: result.pixels };
  post({ type: "displayed", resetCount, ...render(start) });
}

self.onmessage = (event: MessageEvent<MainToWorker>) => {
  const message = event.data;
  try {
    switch (message.type) {
      case "init":
        resetCount = message.resetCount;
        canvas = message.canvas;
        context = canvas.getContext("2d");
        if (!context) throw new Error("Could not create a 2D context");
        break;
      case "view":
        handleView(message);
        break;
      case "params":
        handleParams(message);
        break;
      case "reset":
        resetCount = message.resetCount;
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
