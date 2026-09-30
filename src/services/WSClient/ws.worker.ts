// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { WSClient } from "./WSClient";
import type { WSMessage } from "@src/types/epicsWS";
import type { PVBatch, SnapshotResult, WorkerRequest, WorkerResponse } from "./workerProtocol";

const FLUSH_INTERVAL_MS = 16;

let client: WSClient | null = null;
let closing = false;
const subscribed = new Set<string>();
let batch: PVBatch = emptyBatch();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function emptyBatch(): PVBatch {
  return { updates: {}, disconnected: [], samples: [] };
}

function send(msg: WorkerResponse, transfer: Transferable[] = []): void {
  postMessage(msg, transfer);
}

function flush(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const out = batch;
  batch = emptyBatch();
  if (
    out.disconnected.length === 0 &&
    out.samples.length === 0 &&
    Object.keys(out.updates).length === 0
  ) {
    return;
  }
  // Each binary update owns its buffer and the worker never reads it again
  const transfer = new Set<ArrayBuffer>();
  for (const update of Object.values(out.updates)) {
    if (ArrayBuffer.isView(update.value)) transfer.add(update.value.buffer as ArrayBuffer);
  }
  send({ type: "batch", ...out }, [...transfer]);
}

function dropPending(pvs: Iterable<string>): void {
  const dropped = new Set(pvs);
  for (const pv of dropped) delete batch.updates[pv];
  batch.samples = batch.samples.filter(([pv]) => !dropped.has(pv));
}

/** Metadata fields keep the first value seen, matching the main-thread merge. */
function mergeUpdate(prev: WSMessage, msg: WSMessage): WSMessage {
  return {
    ...prev,
    ...msg,
    display: prev.display ?? msg.display,
    control: prev.control ?? msg.control,
    valueAlarm: prev.valueAlarm ?? msg.valueAlarm,
  };
}

function onMessage(msg: WSMessage): void {
  if (!subscribed.has(msg.pv)) {
    console.warn(`received message from unsolicited PV: ${msg.pv}`);
    return;
  }
  if (msg.connected === false) {
    dropPending([msg.pv]);
    batch.disconnected.push(msg.pv);
  } else {
    if (typeof msg.value === "number" && msg.timeStamp) {
      batch.samples.push([msg.pv, msg.timeStamp, msg.value]);
    }
    const prev = batch.updates[msg.pv];
    batch.updates[msg.pv] = prev ? mergeUpdate(prev, msg) : msg;
  }
  flushTimer ??= setTimeout(flush, FLUSH_INTERVAL_MS);
}

function onConnection(connected: boolean): void {
  // Deliver pending data before the state change so the main thread sees them in order
  flush();
  if (!connected) subscribed.clear();
  send({ type: "connection", connected });
  if (!connected && closing) self.close();
}

function rpc(id: number, request: (c: WSClient) => Promise<SnapshotResult>): void {
  if (!client) {
    send({ type: "rpcResult", id, ok: false, error: "Not connected" });
    return;
  }
  request(client).then(
    (data) => send({ type: "rpcResult", id, ok: true, data }),
    (error: unknown) => send({ type: "rpcResult", id, ok: false, error: String(error) }),
  );
}

addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  switch (req.type) {
    case "open":
      client = new WSClient(req.url, onConnection, onMessage);
      client.open();
      break;
    case "subscribe":
      for (const pv of req.pvs) subscribed.add(pv);
      client?.subscribe(req.pvs);
      break;
    case "unsubscribe":
      for (const pv of req.pvs) subscribed.delete(pv);
      dropPending(req.pvs);
      client?.unsubscribe(req.pvs);
      break;
    case "write":
      client?.write(req.pv, req.value);
      break;
    case "snapshot":
      rpc(req.id, (c) => c.requestSnapshot());
      break;
    case "restore":
      rpc(req.id, (c) => c.restoreSnapshot(req.pvs));
      break;
    case "close":
      closing = true;
      if (client?.isConnected()) client.close();
      else self.close();
      break;
  }
});
