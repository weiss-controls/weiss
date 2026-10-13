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
import type { MainToWorker, WorkerToMain } from "./workerProtocol.ts";
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
  | { kind: "image" }
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

function formatValue(value: number): string {
  // 64-bit integers arrive as doubles; integral values are shown in full
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(6)));
}

interface Frame {
  uniqueId: number;
  info: NDArrayInfo;
  value: NumericArray;
  layout: ImageLayout;
}

/**
 * Feeds the frames of one PV to a render worker and shows the result on a canvas it owns.
 *
 * Delivery is bounded: one frame is with the worker at a time and at most one is waiting on
 * this side, so a slow worker makes the display skip frames instead of queueing them. Anything
 * from an older epoch is ignored; the epoch changes whenever the displayed image is discarded.
 * View changes are sent at most once per animation frame and never discard the image.
 */
export class AdController {
  private readonly canvas: HTMLCanvasElement;
  private readonly readout: HTMLDivElement;
  private readonly onStatus: (status: AdStatus) => void;
  private worker: Worker | null = null;
  private unsubscribe: Unsubscribe | null = null;
  private detachInput: (() => void) | null = null;
  private epoch = 1;
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
  private viewRequest = 0;
  private pointer: Point | null = null;
  private readoutEnabled = true;

  constructor(
    container: HTMLElement,
    pv: string,
    source: FrameSource,
    orientation: Orientation,
    onStatus: (status: AdStatus) => void,
  ) {
    this.onStatus = onStatus;
    this.orientation = orientation;
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
    this.send({ type: "init", epoch: this.epoch, canvas }, [canvas]);
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

  private send(message: MainToWorker, transfer: Transferable[] = []) {
    this.worker?.postMessage(message, transfer);
  }

  private stopInput() {
    this.detachInput?.();
    this.detachInput = null;
    cancelAnimationFrame(this.viewRequest);
    this.viewRequest = 0;
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
    if (this.viewRequest || !this.worker) return;
    this.viewRequest = requestAnimationFrame(() => {
      this.viewRequest = 0;
      this.sendView();
    });
  }

  private sendView() {
    cancelAnimationFrame(this.viewRequest);
    this.viewRequest = 0;
    this.send({
      type: "view",
      ...this.view,
      pixelRatio: this.pixelRatio,
      orientation: this.orientation,
      state: this.state,
    });
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
    const current = this.status;
    if (
      current?.kind === status.kind &&
      (current.kind !== "rejected" ||
        (status.kind === "rejected" &&
          current.code === status.code &&
          current.message === status.message))
    ) {
      return;
    }
    this.status = status;
    this.onStatus(status);
  }

  /** Drops the image on screen and everything queued for it */
  private discard() {
    this.epoch++;
    this.inFlight = null;
    this.pending = null;
    this.displayed = null;
    this.updateReadout();
    this.send({ type: "reset", epoch: this.epoch });
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
    // A new image size starts at fit; the view goes first so the frame is drawn with it
    if (
      this.lastSize &&
      (this.lastSize.width !== layout.width || this.lastSize.height !== layout.height)
    ) {
      this.state = FIT;
      this.sendView();
    }
    this.lastSize = { width: layout.width, height: layout.height };
    this.inFlight = frame;
    // Copied rather than transferred: the store's array is shared with other consumers
    this.send({ type: "frame", epoch: this.epoch, uniqueId, info, value });
  }

  private release() {
    this.inFlight = null;
    const next = this.pending;
    this.pending = null;
    if (next) this.dispatch(next);
  }

  private handleMessage(message: WorkerToMain) {
    if (this.disposed || message.epoch !== this.epoch) return;
    switch (message.type) {
      case "displayed":
        this.displayed = this.inFlight;
        this.updateReadout();
        this.setStatus({ kind: "image" });
        this.release();
        break;
      case "rejected":
        this.displayed = null;
        this.updateReadout();
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
    this.canvas.style.visibility = "hidden";
    this.setStatus({ kind: "rejected", code: "workerError", message });
  }
}
