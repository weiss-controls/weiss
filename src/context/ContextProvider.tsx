import useEpicsWS from "./useEpicsWS";
import { EpicsWSContext } from "./useEpicsWSContext";
import { UIContext } from "./useUIContext";
import useUIManager from "./useUIManager";
import { WidgetContext } from "./useWidgetContext";
import { useWidgetManager } from "./useWidgetManager";

export const ContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const widgetManager = useWidgetManager();
  const ws = useEpicsWS(widgetManager.PVMap);
  const ui = useUIManager(
    ws,
    widgetManager.setSelectedWidgetIDs,
    widgetManager.editorWidgets,
    widgetManager.formatWdgToExport,
    widgetManager.fileLoadedTrig,
    widgetManager.clearAllWidgets,
  );

  return (
    <WidgetContext.Provider value={widgetManager}>
      <EpicsWSContext.Provider value={ws}>
        <UIContext.Provider value={ui}>{children}</UIContext.Provider>
      </EpicsWSContext.Provider>
    </WidgetContext.Provider>
  );
};
