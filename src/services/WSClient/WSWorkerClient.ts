// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { PVWriteValue } from "@src/types/epicsWS";
import type { PVBatch, SnapshotResult, WorkerRequest, WorkerResponse } from "./workerProtocol";

type ConnectionHandler = (connected: boolean) => void;
type BatchHandler = (batch: PVBatch) => void;

const TERMINATE_GRACE_MS = 5000;

/**
 * Main-thread handle to the WebSocket worker. The socket, binary decoding and
 * per-PV handling run in `ws.worker.ts`; this class only sends commands and
 * delivers batched updates.
 */
export class WSWorkerClient {
  private worker: Worker;
  private url: string;
  private onConnection: ConnectionHandler;
  private onBatch: BatchHandler;
  private connected = false;
  private nextRpcId = 0;
  private pending = new Map<
    number,
    { resolve: (data: SnapshotResult) => void; reject: (e: Error) => void }
  >();

  constructor(url: string, onConnection: ConnectionHandler, onBatch: BatchHandler) {
    this.url = url;
    this.onConnection = onConnection;
    this.onBatch = onBatch;
    this.worker = new Worker(new URL("./ws.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handle(event.data);
    this.worker.onerror = (event) => console.error("WebSocket worker error:", event);
  }

  private post(msg: WorkerRequest): void {
    this.worker.postMessage(msg);
  }

  private handle(msg: WorkerResponse): void {
    switch (msg.type) {
      case "connection":
        this.connected = msg.connected;
        this.onConnection(msg.connected);
        break;
      case "batch":
        this.onBatch(msg);
        break;
      case "rpcResult": {
        const call = this.pending.get(msg.id);
        if (!call) return;
        this.pending.delete(msg.id);
        if (msg.ok) call.resolve(msg.data);
        else call.reject(new Error(msg.error));
        break;
      }
    }
  }

  private rpc(build: (id: number) => WorkerRequest): Promise<SnapshotResult> {
    const id = this.nextRpcId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.post(build(id));
    });
  }

  open(): void {
    this.post({ type: "open", url: this.url });
  }

  isConnected(): boolean {
    return this.connected;
  }

  subscribe(pvs: string[]): void {
    this.post({ type: "subscribe", pvs });
  }

  unsubscribe(pvs: string[]): void {
    this.post({ type: "unsubscribe", pvs });
  }

  write(pv: string, value: PVWriteValue): void {
    this.post({ type: "write", pv, value });
  }

  requestSnapshot(): Promise<SnapshotResult> {
    return this.rpc((id) => ({ type: "snapshot", id }));
  }

  restoreSnapshot(pvs: Record<string, { value: PVWriteValue }>): Promise<SnapshotResult> {
    return this.rpc((id) => ({ type: "restore", id, pvs }));
  }

  /** Closes the socket gracefully; the worker exits itself once the socket is closed. */
  close(): void {
    this.worker.onmessage = null;
    this.connected = false;
    for (const call of this.pending.values()) call.reject(new Error("Session closed"));
    this.pending.clear();
    this.post({ type: "close" });
    const worker = this.worker;
    setTimeout(() => worker.terminate(), TERMINATE_GRACE_MS);
  }
}
