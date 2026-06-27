// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import useEpicsWS from "./useEpicsWS";
import { EpicsWSContext, PVStateContext, WSActionsContext } from "./useEpicsWSContext";
import { UIContext } from "./useUIContext";
import useUIManager from "./useUIManager";
import { WidgetContext } from "./useWidgetContext";
import { useWidgetManager } from "./useWidgetManager";

export const ContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const widgetManager = useWidgetManager();
  const { pvState, ...ws } = useEpicsWS(widgetManager.resolvedPVList);
  const ui = useUIManager(
    ws,
    widgetManager.setSelectedWidgetIDs,
    widgetManager.editorWidgets,
    widgetManager.formatWdgToExport,
    widgetManager.fileLoadedTrig,
    widgetManager.fileImportedTrig,
    widgetManager.clearAllWidgets,
    widgetManager.loadWidgets,
    widgetManager.snapshotEditModeMacros,
    widgetManager.restoreEditModeMacros,
  );

  return (
    <WidgetContext.Provider value={widgetManager}>
      <EpicsWSContext.Provider value={ws}>
        <PVStateContext.Provider value={pvState}>
          <WSActionsContext.Provider value={{ writePVValue: ws.writePVValue }}>
            <UIContext.Provider value={ui}>{children}</UIContext.Provider>
          </WSActionsContext.Provider>
        </PVStateContext.Provider>
      </EpicsWSContext.Provider>
    </WidgetContext.Provider>
  );
};
