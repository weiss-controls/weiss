// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useCallback, useEffect, useRef, useState } from "react";
import { WSClient } from "@src/services/WSClient/WSClient";
import type { PVValue, WSMessage } from "@src/types/epicsWS";
import { WS_URL } from "@src/constants/constants";
import { usePVStore } from "@src/services/pvStore";

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
   * Handles incoming WebSocket messages.
   * Merges partial/sticky metadata fields and writes to the Zustand pvStore.
   */
  const onMessage = useCallback((msg: WSMessage) => {
    if (!subscribedRef.current.has(msg.pv)) {
      console.warn(`received message from unsolicited PV: ${msg.pv}`);
      return;
    }
    const prev = usePVStore.getState().pvs[msg.pv] ?? {};
    const data = {
      pv: msg.pv,
      value: msg.value ?? prev.value,
      enumChoices: msg.enumChoices ?? prev.enumChoices,
      alarm: msg.alarm ?? prev.alarm,
      timeStamp: msg.timeStamp ?? prev.timeStamp,
      display: prev.display ?? msg.display,
      control: prev.control ?? msg.control,
      valueAlarm: prev.valueAlarm ?? msg.valueAlarm,
    };
    usePVStore.getState().setPVs({ [msg.pv]: data });
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
    setWSConnected(false);
    usePVStore.getState().clearPVs();
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
