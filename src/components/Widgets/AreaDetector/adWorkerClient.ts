// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { NDArrayInfo, NumericArray, PVData } from "@src/types/epicsWS";
import type { FrameSource, Unsubscribe } from "./frameSource.ts";
import {
  type ImageLayout,
  type RejectCode,
  pixelValue,
  resolveLayout,
} from "./worker/imageLayout.ts";
import { formatValue } from "./format.ts";
import type { FrameStats, MainToWorker, WorkerToMain } from "./workerProtocol.ts";
import { type RenderParams, sameRenderParams } from "./worker/render.ts";
import {
  FIT,
  type Orientation,
  type Point,
  type Size,
  type ViewState,
  capPixelRatio,
  panBy,
  viewToImage,
  zoomAt,
} from "./viewport.ts";
import { attachViewportInput } from "./viewportInput.ts";

export type AdStatus =
  | { kind: "waiting" }
  | { kind: "image"; color: "mono" | "rgb" }
  | {
      kind: "rejected";
      code: RejectCode | "unsupportedBrowser" | "workerError";
      message: string;
    };

const READOUT_STYLE = {
  position: "absolute",
  left: "4px",
  bottom: "4px",
  padding: "1px 6px",
  borderRadius: "2px",
  background: "rgba(0, 0, 0, 0.6)",
  color: "white",
  font: "12px monospace",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  display: "none",
};

interface Frame {
  uniqueId: number;
  info: NDArrayInfo;
  value: NumericArray;
  layout: ImageLayout;
}

function sameStatus(a: AdStatus | null, b: AdStatus): boolean {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === "image" && b.kind === "image") return a.color === b.color;
  if (a.kind === "rejected" && b.kind === "rejected") {
    return a.code === b.code && a.message === b.message;
  }
  return true;
}

export interface AdControllerOptions {
  orientation: Orientation;
  params: RenderParams;
  onStatus: (status: AdStatus) => void;
  /** What the image on screen was rendered with; null when there is none */
  onStats: (stats: FrameStats | null) => void;
}

/**
 * Feeds the frames of one PV to a render worker and shows the result on a canvas it owns.
 *
 * Delivery is bounded: one frame is with the worker at a time and at most one is waiting on
 * this side, so a slow worker makes the display skip frames instead of queueing them.
 * `resetCount` goes up whenever the displayed image is discarded, and replies sent before that
 * are ignored. View and rendering parameter changes are sent at most once per animation frame
 * and never discard the image.
 */
export class AdController {
  private readonly canvas: HTMLCanvasElement;
  private readonly readout: HTMLDivElement;
  private readonly onStatus: (status: AdStatus) => void;
  private readonly onStats: (stats: FrameStats | null) => void;
  private worker: Worker | null = null;
  private unsubscribe: Unsubscribe | null = null;
  private detachInput: (() => void) | null = null;
  private resetCount = 1;
  private inFlight: Frame | null = null;
  private pending: Frame | null = null;
  /** The frame on screen, as acknowledged by the worker */
  private displayed: Frame | null = null;
  private lastSize: Size | null = null;
  // Store updates that do not carry a new frame keep the same array
  private lastValue: unknown;
  private status: AdStatus | null = null;
  private disposed = false;
  private view: Size = { width: 0, height: 0 };
  private pixelRatio = 1;
  private orientation: Orientation;
  private state: ViewState = FIT;
  private params: RenderParams;
  private viewChanged = false;
  private paramsChanged = false;
  private flushRequest = 0;
  private pointer: Point | null = null;
  private readoutEnabled = true;

  constructor(
    container: HTMLElement,
    pv: string,
    source: FrameSource,
    options: AdControllerOptions,
  ) {
    this.onStatus = options.onStatus;
    this.onStats = options.onStats;
    this.orientation = options.orientation;
    this.params = options.params;
    // A canvas can only be transferred once, so every controller makes its own
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, { display: "block", width: "100%", height: "100%" });
    container.appendChild(this.canvas);
    // Written directly, so a frame never re-renders React
    this.readout = document.createElement("div");
    Object.assign(this.readout.style, READOUT_STYLE);
    container.appendChild(this.readout);
    this.setStatus({ kind: "waiting" });

    if (typeof OffscreenCanvas === "undefined" || !("transferControlToOffscreen" in this.canvas)) {
      this.setStatus({
        kind: "rejected",
        code: "unsupportedBrowser",
        message: "This browser cannot render images off the main thread",
      });
      return;
    }

    this.worker = new Worker(new URL("./worker/ad.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (event: MessageEvent<WorkerToMain>) => this.handleMessage(event.data);
    this.worker.onerror = (event) => this.fail(event.message || "Image renderer failed to start");
    this.worker.onmessageerror = () => this.fail("Image renderer sent an unreadable message");

    const canvas = this.canvas.transferControlToOffscreen();
    this.send({ type: "init", resetCount: this.resetCount, canvas }, [canvas]);
    this.send({ type: "params", params: this.params });
    this.detachInput = attachViewportInput(container, {
      onResize: (view, pixelRatio) => this.resize(view, pixelRatio),
      onZoom: (factor, point) =>
        this.changeView((image) =>
          zoomAt(this.view, image, this.orientation, this.state, factor, point),
        ),
      onPan: (dx, dy) =>
        this.changeView((image) => panBy(this.view, image, this.orientation, this.state, dx, dy)),
      onReset: () => this.changeView(() => FIT),
      onHover: (point) => {
        this.pointer = point;
        this.updateReadout();
      },
    });
    this.unsubscribe = source(pv, (data) => this.handleData(data));
  }

  dispose() {
    this.disposed = true;
    this.stopInput();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.worker?.terminate();
    this.worker = null;
    this.canvas.remove();
    this.readout.remove();
  }

  setReadoutEnabled(enabled: boolean) {
    this.readoutEnabled = enabled;
    this.updateReadout();
  }

  /** The view is kept: its centre refers to the unoriented image */
  setOrientation(orientation: Orientation) {
    const current = this.orientation;
    if (
      current.rotation === orientation.rotation &&
      current.flipX === orientation.flipX &&
      current.flipY === orientation.flipY
    ) {
      return;
    }
    this.orientation = orientation;
    this.requestView();
  }

  /** Re-renders the image on screen with the new parameters */
  setParams(params: RenderParams) {
    if (sameRenderParams(this.params, params)) return;
    this.params = params;
    this.paramsChanged = true;
    this.requestFlush();
  }

  private send(message: MainToWorker, transfer: Transferable[] = []) {
    this.worker?.postMessage(message, transfer);
  }

  private stopInput() {
    this.detachInput?.();
    this.detachInput = null;
    cancelAnimationFrame(this.flushRequest);
    this.flushRequest = 0;
  }

  private resize(view: Size, pixelRatio: number) {
    const ratio = capPixelRatio(view, pixelRatio);
    if (
      view.width === this.view.width &&
      view.height === this.view.height &&
      ratio === this.pixelRatio
    ) {
      return;
    }
    this.view = view;
    this.pixelRatio = ratio;
    this.requestView();
  }

  /** Zoom and pan act on the image on screen */
  private changeView(update: (image: Size) => ViewState) {
    if (!this.displayed) return;
    this.state = update(this.displayed.layout);
    this.requestView();
  }

  private requestView() {
    this.updateReadout();
    this.viewChanged = true;
    this.requestFlush();
  }

  private requestFlush() {
    if (this.flushRequest || !this.worker) return;
    this.flushRequest = requestAnimationFrame(() => {
      this.flushRequest = 0;
      this.flush();
    });
  }

  /** Sends the pending view and parameter changes */
  private flush() {
    cancelAnimationFrame(this.flushRequest);
    this.flushRequest = 0;
    if (this.viewChanged) {
      this.send({
        type: "view",
        ...this.view,
        pixelRatio: this.pixelRatio,
        orientation: this.orientation,
        state: this.state,
      });
    }
    if (this.paramsChanged) this.send({ type: "params", params: this.params });
    this.viewChanged = false;
    this.paramsChanged = false;
  }

  /** Array indices and raw value(s) of the displayed pixel under the pointer */
  private updateReadout() {
    const frame = this.displayed;
    const pixel =
      this.readoutEnabled && frame && this.pointer
        ? viewToImage(this.view, frame.layout, this.orientation, this.state, this.pointer)
        : null;
    if (!frame || !pixel) {
      this.readout.style.display = "none";
      return;
    }
    const values = pixelValue(frame.value, frame.layout, pixel.x, pixel.y);
    this.readout.textContent = `x ${pixel.x}, y ${pixel.y}: ${values.map(formatValue).join(", ")}`;
    this.readout.style.display = "block";
  }

  private setStatus(status: AdStatus) {
    if (sameStatus(this.status, status)) return;
    this.status = status;
    this.onStatus(status);
  }

  /** Drops the image on screen and everything queued for it */
  private discard() {
    this.resetCount++;
    this.inFlight = null;
    this.pending = null;
    this.displayed = null;
    this.updateReadout();
    this.onStats(null);
    this.send({ type: "reset", resetCount: this.resetCount });
  }

  private handleData(data: PVData | undefined) {
    if (this.disposed || !this.worker) return;
    if (!data) {
      this.lastValue = undefined;
      this.discard();
      this.setStatus({ kind: "waiting" });
      return;
    }
    if (data.value === this.lastValue) return;
    this.lastValue = data.value;

    // Refused frames are not worth copying to the worker
    const check = resolveLayout(data.value, data.ndarray);
    if (!check.ok) {
      if (this.status?.kind !== "rejected") this.discard();
      this.setStatus({ kind: "rejected", code: check.code, message: check.message });
      return;
    }

    const frame = {
      uniqueId: check.info.uniqueId,
      info: check.info,
      value: check.pixels,
      layout: check.layout,
    };
    if (this.inFlight) this.pending = frame;
    else this.dispatch(frame);
  }

  private dispatch(frame: Frame) {
    const { uniqueId, info, value, layout } = frame;
    // A new image size starts at fit
    if (
      this.lastSize &&
      (this.lastSize.width !== layout.width || this.lastSize.height !== layout.height)
    ) {
      this.state = FIT;
      this.viewChanged = true;
    }
    // Pending changes go first, so the frame is drawn with them
    this.flush();
    this.lastSize = { width: layout.width, height: layout.height };
    this.inFlight = frame;
    // Copied rather than transferred: the store's array is shared with other consumers
    this.send({ type: "frame", resetCount: this.resetCount, uniqueId, info, value });
  }

  private release() {
    this.inFlight = null;
    const next = this.pending;
    this.pending = null;
    if (next) this.dispatch(next);
  }

  private handleMessage(message: WorkerToMain) {
    if (this.disposed || message.resetCount !== this.resetCount) return;
    switch (message.type) {
      case "displayed":
        this.displayed = this.inFlight;
        this.updateReadout();
        this.onStats(message);
        this.setStatus({ kind: "image", color: message.kind === "mono" ? "mono" : "rgb" });
        this.release();
        break;
      case "rendered":
        // A re-render of the frame on screen; delivery is not affected
        this.onStats(message);
        break;
      case "rejected":
        this.displayed = null;
        this.updateReadout();
        this.onStats(null);
        this.setStatus({ kind: "rejected", code: message.code, message: message.message });
        this.release();
        break;
      case "error":
        this.fail(message.message);
        break;
    }
  }

  /** Stops for good; a canvas handed to the worker cannot be cleared from here, so it is hidden */
  private fail(message: string) {
    if (this.disposed || !this.worker) return;
    this.worker.terminate();
    this.worker = null;
    this.stopInput();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.inFlight = null;
    this.pending = null;
    this.displayed = null;
    this.updateReadout();
    this.onStats(null);
    this.canvas.style.visibility = "hidden";
    this.setStatus({ kind: "rejected", code: "workerError", message });
  }
}
