// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

/**
 * PV WebSocket session: one module-level `WSClient`, PV subscriptions and message routing.
 *
 * PV data is written to the Zustand pvStore and image frames to the imageStore, batched once per
 * animation frame. Only components that select a PV re-render on its updates.
 */

import { WSClient } from "./WSClient";
import type { Alarm, NDArrayInfo, PVData, PVWriteValue, WSMessage } from "@src/types/epicsWS";
import { WS_URL } from "@src/constants/constants";
import { usePVStore } from "@src/stores/pvStore";
import {
  EMPTY_FRAME,
  type ImageFrame,
  isImagePV,
  registeredImagePVs,
  useImageStore,
} from "@src/stores/imageStore";
import { useWSStore } from "@src/stores/wsStore";
import { pushPVHistory, clearPVHistory } from "@src/utils/historyBuffers";
import { isTypedNumericArray } from "@src/utils/numericArray";

/** Maximum age of an image PV's summary in the PV store (keeps its timestamp current) */
const IMAGE_SUMMARY_INTERVAL_MS = 1000;

let ws: WSClient | null = null;
/** PVs the session should be subscribed to */
let wantedPVs: string[] = [];
/** PVs currently subscribed on the server */
let subscribedPVs = new Set<string>();
/**
 * PV updates accumulate here between animation frames. One requestAnimationFrame flush writes
 * them to the stores, capping the re-render rate at the display rate.
 */
let pendingPVs: Record<string, PVData> = {};
/** Image frames waiting for the image store, latest per PV */
let pendingFrames: Record<string, ImageFrame> = {};
/** Last summary written to the PV store per image PV, and when */
let imageSummaries: Record<string, { key: string; time: number }> = {};
let rafHandle: number | null = null;

/** Summary fields of an image PV other than its timestamp; a change is written immediately */
function imageSummaryKey(ndarray: NDArrayInfo | undefined, alarm: Alarm | undefined): string {
  const alarmKey = `${alarm?.severity} ${alarm?.status}`;
  if (!ndarray) return alarmKey;
  const sizes = ndarray.dimension.map((d) => d.size).join("x");
  return `${alarmKey} ${sizes} ${ndarray.colorMode} ${ndarray.codec.name} ${ndarray.codec.dtype}`;
}

/**
 * Merge a WSMessage into the pending accumulator (sticky metadata fields).
 * `ndarray` belongs to its frame and is not carried over; an image frame without pixel data
 * gets an empty value.
 */
function buildPVData(msg: WSMessage): PVData {
  const prev: Partial<PVData> = pendingPVs[msg.pv] ?? usePVStore.getState().pvs[msg.pv] ?? {};
  return {
    pv: msg.pv,
    value: msg.value ?? (msg.ndarray ? EMPTY_FRAME : prev.value),
    enumChoices: msg.enumChoices ?? prev.enumChoices,
    alarm: msg.alarm ?? prev.alarm,
    timeStamp: msg.timeStamp ?? prev.timeStamp,
    display: prev.display ?? msg.display,
    control: prev.control ?? msg.control,
    valueAlarm: prev.valueAlarm ?? msg.valueAlarm,
    ndarray: msg.ndarray,
  };
}

/**
 * Handles incoming WebSocket messages.
 * Updates are batched and written to the stores once per animation frame;
 * Scalar samples go to the plot history buffers.
 * A disconnect removes the PV's data and history.
 * Image frames (with `ndarray`, or of a registered image PV) go to the dedicated image store, and
 * the PV store gets a summary of the PV without its pixels.
 */
function onMessage(msg: WSMessage) {
  if (!subscribedPVs.has(msg.pv)) {
    console.warn(`received message from unsolicited PV: ${msg.pv}`);
    return;
  }
  if (msg.connected === false) {
    delete pendingPVs[msg.pv];
    delete pendingFrames[msg.pv];
    delete imageSummaries[msg.pv];
    usePVStore.getState().removePVs([msg.pv]);
    useImageStore.getState().removeFrames([msg.pv]);
    clearPVHistory([msg.pv]);
    return;
  }
  // Includes plain array PVs registered as images (no ndarray)
  if (msg.ndarray || isImagePV(msg.pv)) {
    pendingFrames[msg.pv] = {
      value: isTypedNumericArray(msg.value) ? msg.value : EMPTY_FRAME,
      ndarray: msg.ndarray,
      timeStamp: msg.timeStamp,
      alarm: msg.alarm,
    };
    const key = imageSummaryKey(msg.ndarray, msg.alarm);
    const now = performance.now();
    const last = imageSummaries[msg.pv];
    if (!last || last.key !== key || now - last.time >= IMAGE_SUMMARY_INTERVAL_MS) {
      imageSummaries[msg.pv] = { key, time: now };
      pendingPVs[msg.pv] = { ...buildPVData(msg), value: EMPTY_FRAME };
    }
  } else {
    if (typeof msg.value === "number" && msg.timeStamp) {
      pushPVHistory(msg.pv, msg.timeStamp, msg.value);
    }
    pendingPVs[msg.pv] = buildPVData(msg);
  }
  rafHandle ??= requestAnimationFrame(() => {
    rafHandle = null;
    const updates = pendingPVs;
    const frames = pendingFrames;
    pendingPVs = {};
    pendingFrames = {};
    if (Object.keys(updates).length > 0) usePVStore.getState().setPVs(updates);
    if (Object.keys(frames).length > 0) useImageStore.getState().setFrames(frames);
  });
}

/** Subscribes and unsubscribes the difference between the wanted and subscribed PVs. */
function syncSubscriptions() {
  if (!ws?.isConnected()) return;
  const wanted = new Set(wantedPVs);
  const toAdd = wantedPVs.filter((pv) => !subscribedPVs.has(pv));
  const toRemove = [...subscribedPVs].filter((pv) => !wanted.has(pv));

  if (toAdd.length > 0) ws.subscribe(toAdd);
  if (toRemove.length > 0) {
    ws.unsubscribe(toRemove);
    for (const pv of toRemove) {
      delete pendingPVs[pv];
      delete pendingFrames[pv];
      delete imageSummaries[pv];
    }
    usePVStore.getState().removePVs(toRemove);
    useImageStore.getState().removeFrames(toRemove);
    clearPVHistory(toRemove);
  }
  subscribedPVs = wanted;
}

function handleConnect(connected: boolean) {
  useWSStore.getState().setWSConnected(connected);
  useImageStore.getState().setConnected(connected);
  if (connected) {
    syncSubscriptions();
  } else {
    // The server drops all subscriptions with the connection; widgets show the PVs as
    // disconnected until the client reconnects and resubscribes
    subscribedPVs = new Set();
    pendingPVs = {};
    pendingFrames = {};
    imageSummaries = {};
    usePVStore.getState().clearPVs();
    clearPVHistory();
  }
}

/** Sets the PVs to subscribe; applied now if connected, otherwise on connect. */
export function setSubscribedPVs(pvs: string[]) {
  wantedPVs = pvs;
  syncSubscriptions();
}

/** Stops the current WebSocket session and clears all PV data. */
export function stopSession() {
  if (!ws) return;
  ws.unsubscribe([...subscribedPVs]);
  ws.close();
  ws = null;
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }
  subscribedPVs = new Set();
  pendingPVs = {};
  pendingFrames = {};
  imageSummaries = {};
  useWSStore.getState().setWSConnected(false);
  usePVStore.getState().clearPVs();
  useImageStore.getState().setConnected(false);
  clearPVHistory();
}

/** Starts a new WebSocket session, stopping the current one. */
export function startNewSession() {
  if (ws) stopSession();
  const client: WSClient = new WSClient(
    WS_URL,
    // Events of a client replaced by a newer session are ignored
    (connected) => {
      if (ws === client) handleConnect(connected);
    },
    (msg) => {
      if (ws === client) onMessage(msg);
    },
  );
  ws = client;
  client.open();
}

/** Writes a new value to a PV. */
export function writePVValue(pv: string, newValue: PVWriteValue) {
  ws?.write(pv, newValue);
}

/** Takes a snapshot of all currently subscribed PV values. */
export async function takeSnapshot(): Promise<Record<string, unknown> | null> {
  if (!ws) return null;
  try {
    // The server cannot detect plain waveform images (no NTNDArray metadata)
    return await ws.requestSnapshot(registeredImagePVs());
  } catch (e) {
    console.error("Snapshot failed:", e);
    return null;
  }
}

/** Restores PV values from a saved snapshot. */
export async function restoreFromSnapshot(
  pvs: Record<string, { value: PVWriteValue }>,
): Promise<Record<string, unknown> | null> {
  if (!ws) return null;
  try {
    return await ws.restoreSnapshot(pvs);
  } catch (e) {
    console.error("Restore failed:", e);
    return null;
  }
}

// A hot reload of this module replaces its state; close the old socket with it
import.meta.hot?.dispose(stopSession);
