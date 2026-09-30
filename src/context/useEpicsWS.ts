// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useCallback, useEffect, useRef, useState } from "react";
import { WSWorkerClient } from "@src/services/WSClient/WSWorkerClient";
import type { PVBatch } from "@src/services/WSClient/workerProtocol";
import type { PVData, PVWriteValue, WSMessage } from "@src/types/epicsWS";
import { WS_URL } from "@src/constants/constants";
import { usePVStore } from "@src/services/pvStore";
import { pushPVHistory, clearPVHistory } from "@src/utils/historyBuffers";

/**
 * Hook that manages a WebSocket session to the PV WebSocket.
 *
 * The socket itself lives in a dedicated worker (see `ws.worker.ts`), which
 * handles updates and posts them here in ~16 ms batches.
 * PV data is written directly to the Zustand pvStore (no React state).
 * This means PV updates trigger zero React re-renders at the provider level —
 * only components that subscribe to specific PVs via usePVStore re-render.
 *
 * @param resolvedPVList  Flat deduplicated list of all resolved PV names to subscribe to
 */
export default function useEpicsWS(resolvedPVList: string[]) {
  /** WebSocket worker client instance */
  const ws = useRef<WSWorkerClient | null>(null);
  const [wsConnected, setWSConnected] = useState(false);
  /** Tracks which resolved PVs are currently subscribed on the server */
  const subscribedRef = useRef<Set<string>>(new Set());
  /**
   * PV updates accumulate here between animation frames.
   * A single requestAnimationFrame flush writes them all to the Zustand store
   * in one call, capping the React re-render rate at ~60 fps.
   */
  const pendingPVsRef = useRef<Record<string, PVData>>({});
  const rafHandleRef = useRef<number | null>(null);

  /** Merge a WSMessage into the pending accumulator (sticky metadata fields). */
  function buildPVData(msg: WSMessage): PVData {
    const prev: Partial<PVData> =
      pendingPVsRef.current[msg.pv] ?? usePVStore.getState().pvs[msg.pv] ?? {};
    return {
      pv: msg.pv,
      value: msg.value ?? prev.value,
      enumChoices: msg.enumChoices ?? prev.enumChoices,
      alarm: msg.alarm ?? prev.alarm,
      timeStamp: msg.timeStamp ?? prev.timeStamp,
      display: prev.display ?? msg.display,
      control: prev.control ?? msg.control,
      valueAlarm: prev.valueAlarm ?? msg.valueAlarm,
    };
  }

  /**
   * Handles a batch of PV traffic from the WS worker.
   *
   * Disconnected PVs are discarded first so widgets fall back to their "no data"
   * state. Scalar samples are pushed to the history buffers immediately (every
   * sample, not just the latest) so plot history stays lossless. Merged updates
   * are deferred to the next animation frame, so multiple batches arriving in
   * the same frame produce one React re-render cycle, and rendering pauses while
   * the tab is hidden.
   */
  const onBatch = useCallback((batch: PVBatch) => {
    const subscribed = subscribedRef.current;
    if (batch.disconnected.length > 0) {
      for (const pv of batch.disconnected) delete pendingPVsRef.current[pv];
      usePVStore.getState().removePVs(batch.disconnected);
      clearPVHistory(batch.disconnected);
    }
    for (const [pv, timeStamp, value] of batch.samples) {
      if (subscribed.has(pv)) pushPVHistory(pv, timeStamp, value);
    }
    for (const msg of Object.values(batch.updates)) {
      if (subscribed.has(msg.pv)) pendingPVsRef.current[msg.pv] = buildPVData(msg);
    }
    rafHandleRef.current ??= requestAnimationFrame(() => {
      rafHandleRef.current = null;
      const updates = pendingPVsRef.current;
      pendingPVsRef.current = {};
      usePVStore.getState().setPVs(updates);
    });
  }, []);

  // Always kept up to date so the worker client never captures a stale closure.
  const onBatchRef = useRef(onBatch);
  onBatchRef.current = onBatch;
  const stableBatchHandler = useRef<(batch: PVBatch) => void>((batch) => onBatchRef.current(batch));

  /**
   * Handles connection state changes.
   */
  const handleConnect = useCallback(
    (connected: boolean) => {
      setWSConnected(connected);
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
      usePVStore.getState().removePVs(toRemove);
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
    setWSConnected(false);
    usePVStore.getState().clearPVs();
    clearPVHistory();
  }, [setWSConnected]);

  /**
   * Starts a new WebSocket session.
   */
  const startNewSession = useCallback(() => {
    if (ws.current) {
      stopSession();
    }
    ws.current = new WSWorkerClient(WS_URL, handleConnect, stableBatchHandler.current);
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
      return await ws.current.requestSnapshot();
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
