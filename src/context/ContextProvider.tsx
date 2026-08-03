// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { memo, useMemo } from "react";
import useEpicsWS from "./useEpicsWS";
import { EpicsWSContext, WSActionsContext } from "./useEpicsWSContext";
import { UIContext } from "./useUIContext";
import useUIManager from "./useUIManager";
import { WidgetContext } from "./useWidgetContext";
import { useWidgetContext } from "./useWidgetContext";
import { useWidgetManager } from "./useWidgetManager";

/**
 * Layer 3, UI state.
 *
 * Wrapped in React.memo so it only re-renders when the stable ws props
 * (wsConnected, startNewSession, stopSession) actually change.
 * Widget-manager dependencies are read directly from WidgetContext
 * to avoid prop-drilling through EPICSProvider.
 */
const UIProvider = memo(function UIProvider({
  wsConnected,
  startNewSession,
  stopSession,
  children,
}: {
  wsConnected: boolean;
  startNewSession: () => void;
  stopSession: () => void;
  children: React.ReactNode;
}) {
  const {
    setSelectedWidgetIDs,
    editorWidgets,
    formatWdgToExport,
    fileLoadedTrig,
    fileImportedTrig,
    clearAllWidgets,
    loadWidgets,
    snapshotEditModeMacros,
    restoreEditModeMacros,
    runtimeBaseMacros,
    setRuleMacroOverrides,
    resetRuntimeMacros,
  } = useWidgetContext();

  const ui = useUIManager(
    wsConnected,
    startNewSession,
    stopSession,
    setSelectedWidgetIDs,
    editorWidgets,
    formatWdgToExport,
    fileLoadedTrig,
    fileImportedTrig,
    clearAllWidgets,
    loadWidgets,
    snapshotEditModeMacros,
    restoreEditModeMacros,
    runtimeBaseMacros,
    setRuleMacroOverrides,
    resetRuntimeMacros,
  );

  return <UIContext.Provider value={ui}>{children}</UIContext.Provider>;
});

/**
 * Layer 2, EPICS WebSocket session.
 *
 * Re-renders on every pvState tick but only propagates to PVStateContext
 * consumers. EpicsWSContext and UIContext stay stable.
 */
const EPICSProvider: React.FC<{
  resolvedPVList: string[];
  children: React.ReactNode;
}> = ({ resolvedPVList, children }) => {
  const epicsWS = useEpicsWS(resolvedPVList);

  // Memoize the stable context values so re-renders caused by pvState updates
  // do not propagate to EpicsWSContext or WSActionsContext consumers.
  const wsContextValue = useMemo(
    () => ({
      ws: epicsWS.ws,
      wsConnected: epicsWS.wsConnected,
      startNewSession: epicsWS.startNewSession,
      stopSession: epicsWS.stopSession,
      writePVValue: epicsWS.writePVValue,
      takeSnapshot: epicsWS.takeSnapshot,
      restoreFromSnapshot: epicsWS.restoreFromSnapshot,
    }),
    // All callbacks are useCallback-stable. Only wsConnected is reactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [epicsWS.wsConnected],
  );

  const wsActionsValue = useMemo(
    () => ({ writePVValue: epicsWS.writePVValue }),
    // writePVValue is useCallback-stable (never changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <EpicsWSContext.Provider value={wsContextValue}>
      <WSActionsContext.Provider value={wsActionsValue}>
        <UIProvider
          wsConnected={epicsWS.wsConnected}
          startNewSession={epicsWS.startNewSession}
          stopSession={epicsWS.stopSession}
        >
          {children}
        </UIProvider>
      </WSActionsContext.Provider>
    </EpicsWSContext.Provider>
  );
};

/**
 * Layer 1, Widget state (outermost).
 *
 * Only re-renders when widget configuration changes.
 */
export const ContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const widgetManager = useWidgetManager();
  return (
    <WidgetContext.Provider value={widgetManager}>
      <EPICSProvider resolvedPVList={widgetManager.resolvedPVList}>{children}</EPICSProvider>
    </WidgetContext.Provider>
  );
};
