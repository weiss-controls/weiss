// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { NDArrayInfo, NumericArray, PVData } from "@src/types/epicsWS";
import type { FrameSource, Unsubscribe } from "./frameSource.ts";
import { type RejectCode, resolveLayout } from "./worker/imageLayout.ts";
import type { MainToWorker, WorkerToMain } from "./workerProtocol.ts";

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
 */
export class AdController {
  private readonly canvas: HTMLCanvasElement;
  private readonly onStatus: (status: AdStatus) => void;
  private worker: Worker | null = null;
  private bitmapContext: ImageBitmapRenderingContext | null = null;
  private unsubscribe: Unsubscribe | null = null;
  private epoch = 1;
  private inFlight = false;
  private pending: Frame | null = null;
  // Store updates that do not carry a new frame keep the same array
  private lastValue: unknown;
  private status: AdStatus | null = null;
  private disposed = false;

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
    this.canvas.style.objectFit = "contain";
    container.appendChild(this.canvas);
    this.setStatus({ kind: "waiting" });

    const offscreen =
      typeof OffscreenCanvas !== "undefined" && "transferControlToOffscreen" in this.canvas;
    if (!offscreen) {
      this.bitmapContext =
        typeof createImageBitmap === "function" ? this.canvas.getContext("bitmaprenderer") : null;
      if (!this.bitmapContext) {
        this.setStatus({
          kind: "rejected",
          code: "unsupportedBrowser",
          message: "This browser cannot render images off the main thread",
        });
        return;
      }
    }

    this.worker = new Worker(new URL("./worker/ad.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (event: MessageEvent<WorkerToMain>) => this.handleMessage(event.data);
    this.worker.onerror = (event) => this.fail(event.message || "Image renderer failed to start");
    this.worker.onmessageerror = () => this.fail("Image renderer sent an unreadable message");

    if (offscreen) {
      const canvas = this.canvas.transferControlToOffscreen();
      this.send({ type: "init", epoch: this.epoch, canvas }, [canvas]);
    } else {
      this.send({ type: "init", epoch: this.epoch });
    }
    this.unsubscribe = source(pv, (data) => this.handleData(data));
  }

  dispose() {
    this.disposed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.worker?.terminate();
    this.worker = null;
    this.canvas.remove();
  }

  private send(message: MainToWorker, transfer: Transferable[] = []) {
    this.worker?.postMessage(message, transfer);
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
    this.bitmapContext?.transferFromImageBitmap(null);
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
    if (this.disposed || message.epoch !== this.epoch) {
      if (message.type === "displayed") message.bitmap?.close();
      return;
    }
    switch (message.type) {
      case "displayed":
        this.bitmapContext?.transferFromImageBitmap(message.bitmap ?? null);
        this.setStatus({ kind: "image" });
        this.release();
        break;
      case "rejected":
        this.bitmapContext?.transferFromImageBitmap(null);
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
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.inFlight = false;
    this.pending = null;
    this.canvas.style.visibility = "hidden";
    this.setStatus({ kind: "rejected", code: "workerError", message });
  }
}
