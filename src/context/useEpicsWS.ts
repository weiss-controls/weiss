// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useCallback, useEffect, useRef, useState } from "react";
import { WSClient } from "@src/services/WSClient/WSClient";
import type { PVData, PVValue, WSMessage } from "@src/types/epicsWS";
import { WS_URL } from "@src/constants/constants";
import { usePVStore } from "@src/services/pvStore";
import { pushPVHistory, clearPVHistory } from "@src/utils/historyBuffers";

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
   * Handles incoming WebSocket messages.
   *
   * Merges partial/sticky metadata fields into the per-frame accumulator.
   * The actual Zustand store write is deferred to the next animation frame so
   * that multiple messages arriving in the same frame are batched into one
   * React re-render cycle.
   * In case of scalar PVs that have been registered for buffering (plots), push
   * the sample into the history buffer independently of rAF batching so that
   * the history is always up to date even if the widget is not re-rendering.
   */
  const onMessage = useCallback((msg: WSMessage) => {
    if (!subscribedRef.current.has(msg.pv)) {
      console.warn(`received message from unsolicited PV: ${msg.pv}`);
      return;
    }
    if (typeof msg.value === "number" && msg.timeStamp) {
      pushPVHistory(msg.pv, msg.timeStamp, msg.value);
    }
    pendingPVsRef.current[msg.pv] = buildPVData(msg);
    rafHandleRef.current ??= requestAnimationFrame(() => {
      rafHandleRef.current = null;
      const updates = pendingPVsRef.current;
      pendingPVsRef.current = {};
      usePVStore.getState().setPVs(updates);
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
    ws.current = new WSClient(WS_URL, handleConnect, stableMessageHandler.current);
    ws.current.open();
  }, [handleConnect, stopSession]);

  /**
   * Writes a new value to a PV.
   */
  const writePVValue = useCallback((pv: string, newValue: PVValue) => {
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
    async (pvs: Record<string, { value: PVValue }>): Promise<Record<string, unknown> | null> => {
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
