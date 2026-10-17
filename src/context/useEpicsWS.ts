// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { useCallback, useEffect, useRef, useState } from "react";
import { WSClient } from "@src/services/WSClient/WSClient";
import type { Alarm, NDArrayInfo, PVData, PVWriteValue, WSMessage } from "@src/types/epicsWS";
import { WS_URL } from "@src/constants/constants";
import { usePVStore } from "@src/services/pvStore";
import {
  EMPTY_FRAME,
  type ImageFrame,
  isImagePV,
  registeredImagePVs,
  useImageStore,
} from "@src/services/imageStore";
import { pushPVHistory, clearPVHistory } from "@src/utils/historyBuffers";
import { isTypedNumericArray } from "@src/utils/numericArray";

/** Maximum age of an image PV's summary in the PV store (keeps its timestamp current) */
const IMAGE_SUMMARY_INTERVAL_MS = 1000;

/** Summary fields of an image PV other than its timestamp; a change is written immediately */
function imageSummaryKey(ndarray: NDArrayInfo | undefined, alarm: Alarm | undefined): string {
  const alarmKey = `${alarm?.severity} ${alarm?.status}`;
  if (!ndarray) return alarmKey;
  const sizes = ndarray.dimension.map((d) => d.size).join("x");
  return `${alarmKey} ${sizes} ${ndarray.colorMode} ${ndarray.codec.name} ${ndarray.codec.dtype}`;
}

/**
 * Hook that manages a WebSocket session to the PV WebSocket.
 *
 * PV data is written directly to the Zustand pvStore (no React state).
 * This means PV updates trigger zero React re-renders at the provider level —
 * only components that subscribe to specific PVs via usePVStore re-render.
 *
 * @param resolvedPVList  Flat deduplicated list of all resolved PV names to subscribe to
 */
export default function useEpicsWS(resolvedPVList: string[]) {
  /** WebSocket client instance */
  const ws = useRef<WSClient | null>(null);
  const [wsConnected, setWSConnected] = useState(false);
  /** Tracks which resolved PVs are currently subscribed on the server */
  const subscribedRef = useRef<Set<string>>(new Set());
  /**
   * PV updates accumulate here between animation frames.
   * A single requestAnimationFrame flush writes them all to the Zustand store
   * in one call, capping the React re-render rate at ~60 fps regardless of how
   * fast the WebSocket server sends messages.
   */
  const pendingPVsRef = useRef<Record<string, PVData>>({});
  /** Image frames waiting for the image store, latest per PV */
  const pendingFramesRef = useRef<Record<string, ImageFrame>>({});
  /** Last summary written to the PV store per image PV, and when */
  const imageSummariesRef = useRef<Record<string, { key: string; time: number }>>({});
  const rafHandleRef = useRef<number | null>(null);

  /**
   * Merge a WSMessage into the pending accumulator (sticky metadata fields).
   * `ndarray` belongs to its frame and is not carried over; an image frame without pixel data
   * gets an empty value.
   */
  function buildPVData(msg: WSMessage): PVData {
    const prev: Partial<PVData> =
      pendingPVsRef.current[msg.pv] ?? usePVStore.getState().pvs[msg.pv] ?? {};
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
  const onMessage = useCallback((msg: WSMessage) => {
    if (!subscribedRef.current.has(msg.pv)) {
      console.warn(`received message from unsolicited PV: ${msg.pv}`);
      return;
    }
    if (msg.connected === false) {
      delete pendingPVsRef.current[msg.pv];
      delete pendingFramesRef.current[msg.pv];
      delete imageSummariesRef.current[msg.pv];
      usePVStore.getState().removePVs([msg.pv]);
      useImageStore.getState().removeFrames([msg.pv]);
      clearPVHistory([msg.pv]);
      return;
    }
    // Includes plain array PVs registered as images (no ndarray)
    if (msg.ndarray || isImagePV(msg.pv)) {
      pendingFramesRef.current[msg.pv] = {
        value: isTypedNumericArray(msg.value) ? msg.value : EMPTY_FRAME,
        ndarray: msg.ndarray,
        timeStamp: msg.timeStamp,
        alarm: msg.alarm,
      };
      const key = imageSummaryKey(msg.ndarray, msg.alarm);
      const now = performance.now();
      const last = imageSummariesRef.current[msg.pv];
      if (!last || last.key !== key || now - last.time >= IMAGE_SUMMARY_INTERVAL_MS) {
        imageSummariesRef.current[msg.pv] = { key, time: now };
        pendingPVsRef.current[msg.pv] = { ...buildPVData(msg), value: EMPTY_FRAME };
      }
    } else {
      if (typeof msg.value === "number" && msg.timeStamp) {
        pushPVHistory(msg.pv, msg.timeStamp, msg.value);
      }
      pendingPVsRef.current[msg.pv] = buildPVData(msg);
    }
    rafHandleRef.current ??= requestAnimationFrame(() => {
      rafHandleRef.current = null;
      const updates = pendingPVsRef.current;
      const frames = pendingFramesRef.current;
      pendingPVsRef.current = {};
      pendingFramesRef.current = {};
      if (Object.keys(updates).length > 0) usePVStore.getState().setPVs(updates);
      if (Object.keys(frames).length > 0) useImageStore.getState().setFrames(frames);
    });
  }, []);

  // Always kept up to date so the WSClient never captures a stale closure.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const stableMessageHandler = useRef<(msg: WSMessage) => void>((msg) => onMessageRef.current(msg));

  /**
   * Handles connection state changes.
   */
  const handleConnect = useCallback(
    (connected: boolean) => {
      setWSConnected(connected);
      if (!connected) {
        pendingFramesRef.current = {};
        imageSummariesRef.current = {};
      }
      useImageStore.getState().setConnected(connected);
    },
    [setWSConnected],
  );

  /**
   * Reactively subscribes/unsubscribes resolved PVs whenever the widget tree or
   * rulePVList changes or the session connects.
   */
  useEffect(() => {
    if (!wsConnected || !ws.current) {
      subscribedRef.current = new Set();
      return;
    }

    const current = new Set(resolvedPVList);
    const prev = subscribedRef.current;

    const toAdd = resolvedPVList.filter((pv) => !prev.has(pv));
    const toRemove = [...prev].filter((pv) => !current.has(pv));

    if (toAdd.length > 0) ws.current.subscribe(toAdd);
    if (toRemove.length > 0) {
      ws.current.unsubscribe(toRemove);
      for (const pv of toRemove) {
        delete pendingFramesRef.current[pv];
        delete imageSummariesRef.current[pv];
      }
      usePVStore.getState().removePVs(toRemove);
      useImageStore.getState().removeFrames(toRemove);
      clearPVHistory(toRemove);
    }
    subscribedRef.current = current;
  }, [resolvedPVList, wsConnected]);

  /**
   * Stops the current WebSocket session.
   */
  const stopSession = useCallback(() => {
    if (!ws.current) return;
    ws.current.unsubscribe([...subscribedRef.current]);
    ws.current.close();
    ws.current = null;
    if (rafHandleRef.current !== null) {
      cancelAnimationFrame(rafHandleRef.current);
      rafHandleRef.current = null;
    }
    pendingPVsRef.current = {};
    pendingFramesRef.current = {};
    imageSummariesRef.current = {};
    setWSConnected(false);
    usePVStore.getState().clearPVs();
    useImageStore.getState().setConnected(false);
    clearPVHistory();
  }, [setWSConnected]);

  /**
   * Starts a new WebSocket session.
   */
  const startNewSession = useCallback(() => {
    if (ws.current) {
      stopSession();
    }
    ws.current = new WSClient(WS_URL, handleConnect, stableMessageHandler.current);
    ws.current.open();
  }, [handleConnect, stopSession]);

  /**
   * Writes a new value to a PV.
   */
  const writePVValue = useCallback((pv: string, newValue: PVWriteValue) => {
    ws.current?.write(pv, newValue);
  }, []);

  /**
   * Takes a snapshot of all currently subscribed PV values.
   */
  const takeSnapshot = useCallback(async (): Promise<Record<string, unknown> | null> => {
    if (!ws.current) return null;
    try {
      // The server cannot detect plain waveform images (no NTNDArray metadata)
      return await ws.current.requestSnapshot(registeredImagePVs());
    } catch (e) {
      console.error("Snapshot failed:", e);
      return null;
    }
  }, []);

  /**
   * Restores PV values from a saved snapshot.
   */
  const restoreFromSnapshot = useCallback(
    async (
      pvs: Record<string, { value: PVWriteValue }>,
    ): Promise<Record<string, unknown> | null> => {
      if (!ws.current) return null;
      try {
        return await ws.current.restoreSnapshot(pvs);
      } catch (e) {
        console.error("Restore failed:", e);
        return null;
      }
    },
    [],
  );

  return {
    ws,
    wsConnected,
    startNewSession,
    stopSession,
    writePVValue,
    takeSnapshot,
    restoreFromSnapshot,
  };
}
