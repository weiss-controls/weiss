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
 * - Handles subscribing/unsubscribing PVs (using resolved names)
 * - Caches metadata
 * - Forwards updates mapped back to widget PV names
 *
 * @param PVMap Map of widget PV names (may contain macros) to resolved PV names
 */
export default function useEpicsWS(PVMap: ReturnType<typeof useWidgetManager>["PVMap"]) {
  /** WebSocket client instance */
  const ws = useRef<WSClient | null>(null);
  const [wsConnected, setWSConnected] = useState(false);
  const pvCache = useRef<Record<string, PVData>>({});
  const [pvState, setPVState] = useState<Record<string, PVData>>({});
  /** Tracks which resolved PVs are currently subscribed on the server */
  const subscribedRef = useRef<Set<string>>(new Set());
  /**
   * Tracks the previous resolved→widgetPVs map so the subscription effect can
   * detect widget PVs that have migrated to a different resolved PV.
   */
  const prevResolvedMapRef = useRef<Map<string, string[]>>(new Map());

  /** Precompute reverse map for fast lookup (resolved PV → all widget PVs that point to it) */
  const resolvedToWidgetPVs = useMemo(() => {
    const map = new Map<string, string[]>();
    PVMap.forEach((resolved, widgetPV) => {
      const existing = map.get(resolved);
      if (existing) {
        existing.push(widgetPV);
      } else {
        map.set(resolved, [widgetPV]);
      }
    });
    return map;
  }, [PVMap]);

  /** All resolved PV names for subscription */
  const resolvedPVList = useMemo(() => Array.from(PVMap.values()), [PVMap]);

  /**
   * Handles incoming WebSocket messages.
   * - Filters unsolicited PVs
   * - Maps resolved PVs back to widget PV names
   * - Populates metadata (received only once) with previous message content.
   * - Updates PVState object
   */
  const onMessage = useCallback(
    (msg: WSMessage) => {
      const widgetPVs = resolvedToWidgetPVs.get(msg.pv);
      if (!widgetPVs) {
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
      pvCache.current[msg.pv] = { pv: widgetPVs[0], ...baseData };
      setPVState((prev) => {
        const updates: Record<string, PVData> = {};
        for (const widgetPV of widgetPVs) {
          updates[widgetPV] = { pv: widgetPV, ...baseData };
        }
        return { ...prev, ...updates };
      });
    },
    [resolvedToWidgetPVs],
  );

  // Always kept up to date so the WSClient never captures a stale closure.
  // Make sure resolvedToWidgetPVs updates are picked up w/o recreating WSClient.
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
    // Capture and advance the previous map before any early return so it
    // stays in sync with every render that changes resolvedToWidgetPVs.
    const prevResolvedMap = prevResolvedMapRef.current;
    prevResolvedMapRef.current = resolvedToWidgetPVs;

    if (!wsConnected || !ws.current) {
      subscribedRef.current = new Set();
      return;
    }

    const current = new Set(resolvedPVList);
    const prev = subscribedRef.current;

    const toAdd = resolvedPVList.filter((pv) => !prev.has(pv));
    const toRemove = [...prev].filter((pv) => !current.has(pv));
    const toAddSet = new Set(toAdd);

    if (toAdd.length > 0) ws.current.subscribe(toAdd);
    if (toRemove.length > 0) {
      ws.current.unsubscribe(toRemove);
      // Drop cached data for PVs that are no longer displayed
      toRemove.forEach((pv) => {
        delete pvCache.current[pv];
      });
    }

    // Reconcile pvState for every widget PV that has just been remapped to a
    // different resolved target (macro change, pvName rule action, etc.).
    //
    // Four sub-cases, handled in one unified pass:
    //  A) Already-subscribed target, has cached data  → seed pvState from cache
    //     (no new backend message will arrive for an already-subscribed PV)
    //  B) Already-subscribed target, no cached data   → clear pvState so the
    //     widget shows disconnected/invalid instead of the previous PV's value
    //  C) Newly-subscribed target (in toAdd), valid   → clear pvState now;
    //     the backend will push the real value once connected
    //  D) Newly-subscribed target (in toAdd), invalid → same as C; the widget
    //     correctly shows disconnected/invalid until the PV publishes
    const widgetPVsToClear: string[] = [];
    const migratedUpdates: Record<string, PVData> = {};
    resolvedToWidgetPVs.forEach((widgetPVs, resolved) => {
      const cached = pvCache.current[resolved];
      const prevWidgetPVs = new Set(prevResolvedMap.get(resolved) ?? []);
      for (const widgetPV of widgetPVs) {
        if (!prevWidgetPVs.has(widgetPV)) {
          // Widget PV is newly mapped to `resolved`
          if (cached && !toAddSet.has(resolved)) {
            // already subscribed and backend has sent data, update immediately
            migratedUpdates[widgetPV] = { ...cached, pv: widgetPV };
          } else {
            // no reliable data yet - drop stale pvState entry
            widgetPVsToClear.push(widgetPV);
          }
        }
      }
    });
    if (widgetPVsToClear.length > 0 || Object.keys(migratedUpdates).length > 0) {
      setPVState((prev) => {
        const next = { ...prev };
        for (const widgetPV of widgetPVsToClear) delete next[widgetPV];
        return { ...next, ...migratedUpdates };
      });
    }

    subscribedRef.current = current;
  }, [resolvedPVList, wsConnected, resolvedToWidgetPVs]);

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
  const writePVValue = useCallback((pv: string, newValue: PVValue) => {
    ws.current?.write(pv, newValue);
  }, []);

  return {
    ws,
    wsConnected,
    startNewSession,
    stopSession,
    writePVValue,
    pvState,
  };
}
