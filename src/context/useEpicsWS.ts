// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WSClient } from "@src/services/WSClient/WSClient";
import type { PVData, PVValue, WSMessage } from "@src/types/epicsWS";
import type { useWidgetManager } from "./useWidgetManager";
import { WS_URL } from "@src/constants/constants";

/**
 * Hook that manages a WebSocket session to the PV WebSocket.
 *
 * - Handles subscribing/unsubscribing PVs (using substituted names)
 * - Caches metadata
 * - Forwards updates mapped back to original PVs
 *
 * @param PVMap Map of original PVs to macro-substituted PVs
 * @param updatePVData Callback to update PV data in the widget manager
 */
export default function useEpicsWS(PVMap: ReturnType<typeof useWidgetManager>["PVMap"]) {
  /** WebSocket client instance */
  const ws = useRef<WSClient | null>(null);
  const [wsConnected, setWSConnected] = useState(false);
  const pvCache = useRef<Record<string, PVData>>({});
  const [pvState, setPVState] = useState<Record<string, PVData>>({});
  /** Tracks which substituted PVs are currently subscribed on the server */
  const subscribedRef = useRef<Set<string>>(new Set());

  /** Precompute reverse map for fast lookup (substituted: all originals that point to it) */
  const reversePVMap = useMemo(() => {
    const map = new Map<string, string[]>();
    PVMap.forEach((substituted, original) => {
      const existing = map.get(substituted);
      if (existing) {
        existing.push(original);
      } else {
        map.set(substituted, [original]);
      }
    });
    return map;
  }, [PVMap]);

  /** All substituted PVs for subscription */
  const substitutedList = useMemo(() => Array.from(PVMap.values()), [PVMap]);

  /**
   * Handles incoming WebSocket messages.
   * - Filters unsolicited PVs
   * - Maps substituted PVs back to original names
   * - Populates metadata (received only once) with previous message content.
   * - Updates PVState object
   */
  const onMessage = useCallback(
    (msg: WSMessage) => {
      const originalPVs = reversePVMap.get(msg.pv);
      if (!originalPVs) {
        console.warn(`received message from unsolicited PV: ${msg.pv}`);
        return;
      }

      const prev = pvCache.current[msg.pv] ?? {};
      const baseData = {
        value: msg.value ?? prev.value,
        enumChoices: msg.enumChoices ?? prev.enumChoices,
        alarm: msg.alarm ?? prev.alarm,
        timeStamp: msg.timeStamp ?? prev.timeStamp,
        display: prev.display ?? msg.display,
        control: prev.control ?? msg.control,
        valueAlarm: prev.valueAlarm ?? msg.valueAlarm,
      };
      pvCache.current[msg.pv] = { pv: originalPVs[0], ...baseData };
      setPVState((prev) => {
        const updates: Record<string, PVData> = {};
        for (const originalPV of originalPVs) {
          updates[originalPV] = { pv: originalPV, ...baseData };
        }
        return { ...prev, ...updates };
      });
    },
    [reversePVMap],
  );

  // Always kept up to date so the WSClient never captures a stale closure.
  // Make sure reversePVMap updates are picked up w/o recreating WSClient.
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
   * Reactively subscribes/unsubscribes PVs whenever the PV map changes or the
   * session connects. This ensures EmbeddedDisplay children — which populate
   * asynchronously after the initial connect — are subscribed as soon as they
   * appear in the map, without restarting the session.
   */
  useEffect(() => {
    if (!wsConnected || !ws.current) {
      subscribedRef.current = new Set();
      return;
    }

    const current = new Set(substitutedList);
    const prev = subscribedRef.current;

    const toAdd = substitutedList.filter((pv) => !prev.has(pv));
    const toRemove = [...prev].filter((pv) => !current.has(pv));

    if (toAdd.length > 0) ws.current.subscribe(toAdd);
    if (toRemove.length > 0) {
      ws.current.unsubscribe(toRemove);
      // Drop cached data for PVs that are no longer displayed
      toRemove.forEach((pv) => {
        delete pvCache.current[pv];
      });
    }

    subscribedRef.current = current;
  }, [substitutedList, wsConnected]);

  /**
   * Stops the current WebSocket session.
   */
  const stopSession = useCallback(() => {
    if (!ws.current) return;
    ws.current.unsubscribe([...subscribedRef.current]);
    ws.current.close();
    ws.current = null;
    pvCache.current = {};
    setWSConnected(false);
    setPVState({});
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
   * @param pv The pv to be written to (with macros if applicable)
   * @param newValue New value [@type PVValue]
   */
  const writePVValue = useCallback(
    (pv: string, newValue: PVValue) => {
      const substituted = PVMap.get(pv);
      if (substituted) {
        ws.current?.write(substituted, newValue);
      } else {
        console.warn(`writePVValue: unknown PV ${pv}`);
      }
    },
    [PVMap],
  );

  return {
    ws,
    wsConnected,
    startNewSession,
    stopSession,
    writePVValue,
    pvState,
  };
}
