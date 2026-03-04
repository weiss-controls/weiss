// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useCallback, useMemo, useRef, useState } from "react";
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

  /** Precompute reverse map for fast lookup (substituted: original) */
  const reversePVMap = useMemo(() => {
    const map = new Map<string, string>();
    PVMap.forEach((original, substituted) => {
      map.set(original, substituted);
    });
    return map;
  }, [PVMap]);

  /** All substituted PVs for subscription */
  const substitutedList = Array.from(PVMap.values());

  /**
   * Handles incoming WebSocket messages.
   * - Filters unsolicited PVs
   * - Maps substituted PVs back to original names
   * - Populates metadata (received only once) with previous message content.
   * - Updates PVState object
   */
  const onMessage = useCallback(
    (msg: WSMessage) => {
      const originalPV = reversePVMap.get(msg.pv);
      if (!originalPV) {
        console.warn(`received message from unsolicited PV: ${msg.pv}`);
        return;
      }

      const prev = pvCache.current[msg.pv] ?? {};
      const pvData: PVData = {
        pv: originalPV,
        value: msg.value ?? prev.value,
        enumChoices: msg.enumChoices ?? prev.enumChoices,
        alarm: msg.alarm ?? prev.alarm,
        timeStamp: msg.timeStamp ?? prev.timeStamp,
        display: prev.display ?? msg.display,
        control: prev.control ?? msg.control,
        valueAlarm: prev.valueAlarm ?? msg.valueAlarm,
      };
      pvCache.current[msg.pv] = pvData;
      setPVState((prev) => {
        return { ...prev, [pvData.pv]: pvData };
      });
    },
    [reversePVMap],
  );

  /**
   * Handles connection state changes.
   * Subscribes to substituted PVs when connected.
   */
  const handleConnect = useCallback(
    (connected: boolean) => {
      setWSConnected(connected);
      if (connected) {
        ws.current?.subscribe(substitutedList);
      }
    },
    [setWSConnected, substitutedList],
  );

  /**
   * Stops the current WebSocket session.
   */
  const stopSession = useCallback(() => {
    if (!ws.current) return;
    ws.current.unsubscribe(substitutedList);
    ws.current.close();
    ws.current = null;
    setWSConnected(false);
    setPVState({});
  }, [setWSConnected, substitutedList]);

  /**
   * Starts a new WebSocket session.
   */
  const startNewSession = useCallback(() => {
    if (ws.current) {
      stopSession();
    }
    ws.current = new WSClient(WS_URL, handleConnect, onMessage);
    ws.current.open();
  }, [handleConnect, onMessage, stopSession]);

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
