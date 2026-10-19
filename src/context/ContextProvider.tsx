// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { memo, useEffect } from "react";
import { setSubscribedPVs } from "@src/services/WSClient/session";
import { UIContext } from "./useUIContext";
import useUIManager from "./useUIManager";
import { WidgetContext } from "./useWidgetContext";
import { useWidgetContext } from "./useWidgetContext";
import { useWidgetManager } from "./useWidgetManager";

/**
 * UI state, inside the widget state.
 *
 * Wrapped in React.memo; widget-manager dependencies are read directly from WidgetContext
 * to avoid prop-drilling.
 */
const UIProvider = memo(function UIProvider({ children }: { children: React.ReactNode }) {
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
 * Widget state (outermost). Also passes the resolved PV list to the WebSocket session.
 */
export const ContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const widgetManager = useWidgetManager();
  const { resolvedPVList } = widgetManager;

  useEffect(() => {
    setSubscribedPVs(resolvedPVList);
  }, [resolvedPVList]);

  return (
    <WidgetContext.Provider value={widgetManager}>
      <UIProvider>{children}</UIProvider>
    </WidgetContext.Provider>
  );
};
