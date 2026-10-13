// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { NDArrayInfo, NumericArray, PVData } from "@src/types/epicsWS";
import type { FrameSource, Unsubscribe } from "./frameSource.ts";
import { type RejectCode, resolveLayout } from "./worker/imageLayout.ts";
import type { MainToWorker, WorkerToMain } from "./workerProtocol.ts";
import {
  FIT,
  NO_ORIENTATION,
  type Orientation,
  type Size,
  type ViewState,
  capPixelRatio,
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

interface Frame {
  uniqueId: number;
  info: NDArrayInfo;
  value: NumericArray;
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
  private readonly onStatus: (status: AdStatus) => void;
  private worker: Worker | null = null;
  private unsubscribe: Unsubscribe | null = null;
  private detachInput: (() => void) | null = null;
  private epoch = 1;
  private inFlight = false;
  private pending: Frame | null = null;
  // Store updates that do not carry a new frame keep the same array
  private lastValue: unknown;
  private status: AdStatus | null = null;
  private disposed = false;
  private view: Size = { width: 0, height: 0 };
  private pixelRatio = 1;
  private orientation: Orientation = NO_ORIENTATION;
  private state: ViewState = FIT;
  private viewRequest = 0;

  constructor(
    container: HTMLElement,
    pv: string,
    source: FrameSource,
    onStatus: (status: AdStatus) => void,
  ) {
    this.onStatus = onStatus;
    // A canvas can only be transferred once, so every controller makes its own
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, { display: "block", width: "100%", height: "100%" });
    container.appendChild(this.canvas);
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

  private requestView() {
    if (this.viewRequest || !this.worker) return;
    this.viewRequest = requestAnimationFrame(() => {
      this.viewRequest = 0;
      this.send({
        type: "view",
        ...this.view,
        pixelRatio: this.pixelRatio,
        orientation: this.orientation,
        state: this.state,
      });
    });
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
    this.inFlight = false;
    this.pending = null;
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

    const frame = { uniqueId: check.info.uniqueId, info: check.info, value: check.pixels };
    if (this.inFlight) this.pending = frame;
    else this.dispatch(frame);
  }

  private dispatch(frame: Frame) {
    this.inFlight = true;
    // Copied rather than transferred: the store's array is shared with other consumers
    this.send({ type: "frame", epoch: this.epoch, ...frame });
  }

  private release() {
    this.inFlight = false;
    const next = this.pending;
    this.pending = null;
    if (next) this.dispatch(next);
  }

  private handleMessage(message: WorkerToMain) {
    if (this.disposed || message.epoch !== this.epoch) return;
    switch (message.type) {
      case "displayed":
        this.setStatus({ kind: "image" });
        this.release();
        break;
      case "rejected":
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
    this.inFlight = false;
    this.pending = null;
    this.canvas.style.visibility = "hidden";
    this.setStatus({ kind: "rejected", code: "workerError", message });
  }
}
