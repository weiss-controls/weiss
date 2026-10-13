// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { MainToWorker, WorkerToMain } from "../workerProtocol.ts";
import { resolveLayout } from "./imageLayout.ts";
import { type RenderParams, renderFrame } from "./render.ts";

// Intensity controls arrive later; until then every frame uses these defaults
const PARAMS: RenderParams = { scale: "linear", colorMap: "grayscale" };

let epoch = 0;
let canvas: OffscreenCanvas | null = null;
let context: OffscreenCanvasRenderingContext2D | null = null;
// Reused while the frame size stays the same
let imageData: ImageData | null = null;

function post(message: WorkerToMain) {
  postMessage(message);
}

function fail(error: unknown) {
  post({ type: "error", epoch, message: error instanceof Error ? error.message : String(error) });
}

function clear() {
  if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
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

  if (!canvas || !context) throw new Error("Frame received before the canvas");
  if (canvas.width !== layout.width) canvas.width = layout.width;
  if (canvas.height !== layout.height) canvas.height = layout.height;
  context.putImageData(imageData, 0, 0);
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
