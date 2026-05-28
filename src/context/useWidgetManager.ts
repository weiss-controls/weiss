// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useState, useCallback, useRef, useMemo } from "react";
import type {
  Widget,
  WidgetDefinition,
  PropertyKey,
  PropertyUpdates,
  MultiWidgetPropertyUpdates,
  GridPosition,
  ExportedWidget,
  ExportedRule,
  DOMRectLike,
  Rule,
} from "@src/types/widgets";
import { GridZone } from "@components/GridZone";
import { GRID_ID, MAX_HISTORY } from "@src/constants/constants";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import { v4 as uuidv4 } from "uuid";
import { notifyUser } from "@src/services/Notifications/Notification";
import { substituteInStr } from "@src/utils/macros";
import { derivePVNames } from "@components/RulesDialog/ruleDialogUtils";
import {
  createGroupWidget,
  createWidgetInstance,
  deepCloneWidget,
  deepCloneWidgetList,
  getNestedMoveUpdates,
  getSelectedWidgets,
  getWidgetNested,
  updateWidgets,
} from "./widgetHelpers";

/**
 * Hook to manage the editor's widgets and their state.
 *
 * Provides functionality for:
 * - Selection management
 * - Undo/redo history
 * - Copy/paste of widgets
 * - Alignment and distribution
 * - Grouping/Ungrouping
 * - Updating widget properties in batch or individually
 * - Import/export of widget configurations
 */
export function useWidgetManager() {
  const [undoStack, setUndoStack] = useState<Widget[][]>([]);
  const [redoStack, setRedoStack] = useState<Widget[][]>([]);
  const [editorWidgets, setEditorWidgets] = useState<Widget[]>(() => [
    createWidgetInstance(GridZone, GRID_ID),
  ]);
  const [pickedWidget, setPickedWidget] = useState<WidgetDefinition | null>(null); // widget picked from palette
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [selectedWidgetIDs, setSelectedWidgetIDs] = useState<string[]>([]);
  const [fileLoadedTrig, setFileLoadedTrig] = useState(0);
  const [fileImportedTrig, setFileImportedTrig] = useState(0);

  const clipboard = useRef<Widget[]>([]);
  const copiedSelectionBounds = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const allWidgetIDs = useMemo(
    () => editorWidgets.map((w) => w.id).filter((id) => id !== GRID_ID),
    [editorWidgets],
  );

  const selectedWidgets: Widget[] = useMemo(
    () => getSelectedWidgets(editorWidgets, selectedWidgetIDs),
    [editorWidgets, selectedWidgetIDs],
  );

  /* Widgets being edited (shown at the property editor) */
  const editingWidgets = useMemo(() => {
    return selectedWidgets.length > 0
      ? selectedWidgets
      : [editorWidgets.find((w) => w.id === GRID_ID) ?? editorWidgets[0]];
  }, [selectedWidgets, editorWidgets]);

  const computeGroupBounds = useCallback(
    (widgetIds: string[]): DOMRectLike | null => {
      const widgets = editorWidgets.filter((w) => widgetIds.includes(w.id));
      if (!widgets.length) return null;

      const xs = widgets.map((w) => w.editableProperties.x!.value);
      const ys = widgets.map((w) => w.editableProperties.y!.value);
      const ws = widgets.map((w) => w.editableProperties.width!.value);
      const hs = widgets.map((w) => w.editableProperties.height!.value);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs.map((x, i) => x + ws[i]));
      const maxY = Math.max(...ys.map((y, i) => y + hs[i]));
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    },
    [editorWidgets],
  );

  const selectionBounds = useMemo(
    () => computeGroupBounds(selectedWidgetIDs),
    [selectedWidgetIDs, computeGroupBounds],
  );

  /**
   * Update the full widget list.
   * Optionally records undo history.
   * @param newWidgets New widget list or updater function
   * @param keepHistory Whether to store this change in undo stack
   */
  const updateEditorWidgetList = useCallback(
    (newWidgets: Widget[] | ((prev: Widget[]) => Widget[]), keepHistory = true) => {
      setEditorWidgets((prev) => {
        if (keepHistory) {
          setUndoStack((stack) => {
            const updated = [...stack, deepCloneWidgetList(prev)];
            return updated.length > MAX_HISTORY ? updated.slice(1) : updated;
          });
          setRedoStack([]);
        }
        return typeof newWidgets === "function" ? newWidgets(prev) : newWidgets;
      });
    },
    [],
  );

  /**
   * Get a widget by its ID.
   * @param id Widget ID
   * @returns Widget object or undefined
   */
  const getWidget = useCallback(
    (id: string) => getWidgetNested(editorWidgets, id),
    [editorWidgets],
  );

  /**
   * Apply multiple property updates to widgets.
   * @param updates Object mapping widget IDs to property updates
   * @param keepHistory Whether to store this change in undo stack
   */
  const batchWidgetUpdate = useCallback(
    (updates: MultiWidgetPropertyUpdates, keepHistory = true) => {
      const parentIds = Object.keys(updates);
      // propagate size/position changes for children widgets
      for (const id of parentIds) {
        const w = getWidget(id);
        if (!w?.children?.length) continue;
        const update = updates[id];
        const hasPosChange =
          "x" in update || "y" in update || "height" in update || "width" in update;
        if (!hasPosChange) continue;
        const oldX = w.editableProperties.x!.value;
        const oldY = w.editableProperties.y!.value;
        const oldWidth = w.editableProperties.width!.value;
        const oldHeight = w.editableProperties.height!.value;
        const newX = (update.x ?? oldX) as number;
        const newY = (update.y ?? oldY) as number;
        const newWidth = (update.width ?? oldWidth) as number;
        const newHeight = (update.height ?? oldHeight) as number;
        const scaleX = oldWidth ? newWidth / oldWidth : 1;
        const scaleY = oldHeight ? newHeight / oldHeight : 1;
        getNestedMoveUpdates(w, newX - oldX, newY - oldY, scaleX, scaleY, updates);
      }

      updateEditorWidgetList((prev) => updateWidgets(prev, updates), keepHistory);
    },
    [updateEditorWidgetList, getWidget],
  );

  /**
   * Add a new widget to the editor.
   * Auto-assigns an alias of the form "{widgetLabel} {n}" when the widget has a
   * name property that is currently empty (new drops/placements).
   * @param newWidget Widget to add
   */
  const addWidget = useCallback(
    (newWidget: Widget) => {
      updateEditorWidgetList((prev) => {
        let widget = newWidget;
        if (widget.editableProperties.alias?.value === "") {
          const count = prev.filter((w) => w.widgetName === widget.widgetName).length;
          const label = WidgetRegistry[widget.widgetName]?.widgetLabel ?? widget.widgetName;
          widget = {
            ...widget,
            editableProperties: {
              ...widget.editableProperties,
              alias: { ...widget.editableProperties.alias, value: `${label} ${count + 1}` },
            },
          };
        }
        return [...prev, widget];
      });
    },
    [updateEditorWidgetList],
  );

  /**
   * Replace the children of a widget identified by id.
   * Searches recursively so nested widgets are supported.
   * Defaults keepHistory=false because child injection is a side effect, not a user action.
   */
  const updateWidgetChildren = useCallback(
    (id: string, children: Widget[], keepHistory = false) => {
      updateEditorWidgetList((prev) => {
        const replace = (widgets: Widget[]): Widget[] =>
          widgets.map((w) => {
            if (w.id === id) return { ...w, children };
            if (w.children) return { ...w, children: replace(w.children) };
            return w;
          });
        return replace(prev);
      }, keepHistory);
    },
    [updateEditorWidgetList],
  );

  /**
   * Delete currently selected widgets.
   */
  const deleteWidget = useCallback(() => {
    updateEditorWidgetList((prev) => prev.filter((w) => !selectedWidgetIDs.includes(w.id)));
    setSelectedWidgetIDs([]);
  }, [selectedWidgetIDs, updateEditorWidgetList]);

  /**
   * Clear all widgets from editor.
   */
  const clearAllWidgets = useCallback(() => {
    setEditorWidgets([createWidgetInstance(GridZone, GRID_ID)]);
    setSelectedWidgetIDs([]);
  }, []);

  /**
   * Create group with selected widgets.
   */
  const groupSelected = useCallback(() => {
    if (selectedWidgetIDs.length < 2 || !selectionBounds) return;
    const groupID = uuidv4();
    const groupWidget = createGroupWidget(groupID, selectedWidgets, selectionBounds);

    updateEditorWidgetList((prev) => {
      const remainingWidgets = prev.filter((w) => !selectedWidgetIDs.includes(w.id));
      return [...remainingWidgets, groupWidget];
    });

    setSelectedWidgetIDs([groupID]);
  }, [selectedWidgetIDs, selectionBounds, selectedWidgets, updateEditorWidgetList]);

  /**
   * Ungroup selected widgets.
   */
  const ungroupSelected = useCallback(() => {
    updateEditorWidgetList((prev) => {
      const newWidgets: Widget[] = [];

      prev.forEach((w) => {
        if (selectedWidgetIDs.includes(w.id) && w.children && w.widgetName !== "EmbeddedDisplay") {
          newWidgets.push(...w.children);
        } else {
          newWidgets.push(w);
        }
      });

      return newWidgets;
    });

    setSelectedWidgetIDs([]);
  }, [selectedWidgetIDs, updateEditorWidgetList]);

  /**
   * Update properties of a single widget.
   * @param id Widget ID
   * @param changes Object mapping property keys to new values
   * @param keepHistory Whether to store this change in undo stack
   */
  const updateWidgetProperties = useCallback(
    (id: string, changes: PropertyUpdates, keepHistory = true) => {
      const updates: MultiWidgetPropertyUpdates = { [id]: changes };
      batchWidgetUpdate(updates, keepHistory);
    },
    [batchWidgetUpdate],
  );

  /**
   * Move selected widgets one step in the selected diretion on the z-axis.
   *  @param direction "forward" | "backward" | "front" | "back"
   */
  const reorderWidgets = useCallback(
    (direction: "forward" | "backward" | "front" | "back") => {
      if (selectedWidgetIDs.length === 0) return;

      updateEditorWidgetList((prev) => {
        const [gridZone, ...widgets] = prev;
        const others = widgets.filter((w) => !selectedWidgetIDs.includes(w.id));
        const moving = widgets.filter((w) => selectedWidgetIDs.includes(w.id));

        if (moving.length === 0) return prev;

        let newWidgets: Widget[] = [];

        switch (direction) {
          case "forward": {
            const maxIdx = Math.max(...moving.map((w) => widgets.findIndex((p) => p.id === w.id)));
            const insertPos = Math.min(maxIdx + 1, others.length);
            const before = others.slice(0, insertPos);
            const after = others.slice(insertPos);
            newWidgets = [...before, ...moving, ...after];
            break;
          }
          case "backward": {
            const minIdx = Math.min(...moving.map((w) => widgets.findIndex((p) => p.id === w.id)));
            const insertPos = Math.max(minIdx - 1, 0);
            const before = others.slice(0, insertPos);
            const after = others.slice(insertPos);
            newWidgets = [...before, ...moving, ...after];
            break;
          }
          case "front":
            newWidgets = [...others, ...moving];
            break;
          case "back":
            newWidgets = [...moving, ...others];
            break;
        }

        return [gridZone, ...newWidgets];
      });
    },
    [selectedWidgetIDs, updateEditorWidgetList],
  );

  const stepForward = useCallback(() => {
    reorderWidgets("forward");
  }, [reorderWidgets]);

  const stepBackwards = useCallback(() => {
    reorderWidgets("backward");
  }, [reorderWidgets]);

  const bringToFront = useCallback(() => {
    reorderWidgets("front");
  }, [reorderWidgets]);

  const sendToBack = useCallback(() => {
    reorderWidgets("back");
  }, [reorderWidgets]);

  /**
   * Align selected widgets by the left margin.
   */
  const alignLeft = useCallback(() => {
    if (selectedWidgets.length < 2) return;
    const leftX = Math.min(...selectedWidgets.map((w) => w.editableProperties.x?.value ?? 0));
    const updates: MultiWidgetPropertyUpdates = {};
    selectedWidgets.forEach((w) => {
      updates[w.id] = { x: leftX };
    });
    batchWidgetUpdate(updates);
  }, [selectedWidgets, batchWidgetUpdate]);

  /**
   * Align selected widgets by the right margin.
   */
  const alignRight = useCallback(() => {
    if (selectedWidgets.length < 2) return;
    const rightX = Math.max(
      ...selectedWidgets.map(
        (w) => (w.editableProperties.x?.value ?? 0) + (w.editableProperties.width?.value ?? 0),
      ),
    );
    const updates: MultiWidgetPropertyUpdates = {};
    selectedWidgets.forEach((w) => {
      if (!w.editableProperties.x || !w.editableProperties.width) return;
      updates[w.id] = { x: rightX - w.editableProperties.width.value };
    });
    batchWidgetUpdate(updates);
  }, [selectedWidgets, batchWidgetUpdate]);

  /**
   * Align selected widgets by the top margin.
   */
  const alignTop = useCallback(() => {
    if (selectedWidgets.length < 2) return;
    const topY = Math.min(...selectedWidgets.map((w) => w.editableProperties.y?.value ?? 0));
    const updates: MultiWidgetPropertyUpdates = {};
    selectedWidgets.forEach((w) => {
      updates[w.id] = { y: topY };
    });
    batchWidgetUpdate(updates);
  }, [selectedWidgets, batchWidgetUpdate]);

  /**
   * Align selected widgets by the bottom margin.
   */
  const alignBottom = useCallback(() => {
    if (selectedWidgets.length < 2) return;
    const bottomY = Math.max(
      ...selectedWidgets.map(
        (w) => (w.editableProperties.y?.value ?? 0) + (w.editableProperties.height?.value ?? 0),
      ),
    );
    const updates: MultiWidgetPropertyUpdates = {};
    selectedWidgets.forEach((w) => {
      if (!w.editableProperties.y || !w.editableProperties.height) return;
      updates[w.id] = { y: bottomY - w.editableProperties.height.value };
    });
    batchWidgetUpdate(updates);
  }, [selectedWidgets, batchWidgetUpdate]);

  /**
   * Align selected widgets by the horizontal center.
   */
  const alignHorizontalCenter = useCallback(() => {
    if (selectedWidgets.length < 2) return;
    const minX = Math.min(...selectedWidgets.map((w) => w.editableProperties.x?.value ?? 0));
    const maxX = Math.max(
      ...selectedWidgets.map(
        (w) => (w.editableProperties.x?.value ?? 0) + (w.editableProperties.width?.value ?? 0),
      ),
    );
    const centerX = (minX + maxX) / 2;

    const updates: MultiWidgetPropertyUpdates = {};
    selectedWidgets.forEach((w) => {
      if (!w.editableProperties.x || !w.editableProperties.width) return;
      updates[w.id] = { x: centerX - w.editableProperties.width.value / 2 };
    });
    batchWidgetUpdate(updates);
  }, [selectedWidgets, batchWidgetUpdate]);

  /**
   * Align selected widgets by the vertical center.
   */
  const alignVerticalCenter = useCallback(() => {
    if (selectedWidgets.length < 2) return;
    const minY = Math.min(...selectedWidgets.map((w) => w.editableProperties.y?.value ?? 0));
    const maxY = Math.max(
      ...selectedWidgets.map(
        (w) => (w.editableProperties.y?.value ?? 0) + (w.editableProperties.height?.value ?? 0),
      ),
    );
    const centerY = (minY + maxY) / 2;

    const updates: MultiWidgetPropertyUpdates = {};
    selectedWidgets.forEach((w) => {
      if (!w.editableProperties.y || !w.editableProperties.height) return;
      updates[w.id] = { y: centerY - w.editableProperties.height.value / 2 };
    });
    batchWidgetUpdate(updates);
  }, [selectedWidgets, batchWidgetUpdate]);

  /**
   * Distribute selected widgets (3 or more) horizontally.
   * @warning Functionality not tested yet!
   */
  const distributeHorizontal = useCallback(() => {
    if (selectedWidgets.length < 3) return;

    const sorted = [...selectedWidgets].sort(
      (a, b) => (a.editableProperties.x?.value ?? 0) - (b.editableProperties.x?.value ?? 0),
    );

    const leftX = sorted[0].editableProperties.x?.value ?? 0;
    const rightX =
      (sorted[sorted.length - 1].editableProperties.x?.value ?? 0) +
      (sorted[sorted.length - 1].editableProperties.width?.value ?? 0);

    const totalWidth = sorted.reduce((sum, w) => sum + (w.editableProperties.width?.value ?? 0), 0);
    const spacing = (rightX - leftX - totalWidth) / (sorted.length - 1);

    let currentX = leftX;
    const updates: MultiWidgetPropertyUpdates = {};

    sorted.forEach((w, idx) => {
      if (idx === 0 || idx === sorted.length - 1) return; // skip first and last
      if (!w.editableProperties.x) return;
      currentX += (sorted[idx - 1].editableProperties.width?.value ?? 0) + spacing;
      updates[w.id] = { x: currentX };
    });

    batchWidgetUpdate(updates);
  }, [selectedWidgets, batchWidgetUpdate]);

  /**
   * Distribute selected widgets (3 or more) vertically.
   * @warning Functionality not tested yet!
   */
  const distributeVertical = useCallback(() => {
    if (selectedWidgets.length < 3) return;

    const sorted = [...selectedWidgets].sort(
      (a, b) => (a.editableProperties.y?.value ?? 0) - (b.editableProperties.y?.value ?? 0),
    );

    const topY = sorted[0].editableProperties.y?.value ?? 0;
    const bottomY =
      (sorted[sorted.length - 1].editableProperties.y?.value ?? 0) +
      (sorted[sorted.length - 1].editableProperties.height?.value ?? 0);

    const totalHeight = sorted.reduce(
      (sum, w) => sum + (w.editableProperties.height?.value ?? 0),
      0,
    );
    const spacing = (bottomY - topY - totalHeight) / (sorted.length - 1);

    let currentY = topY;
    const updates: MultiWidgetPropertyUpdates = {};

    sorted.forEach((w, idx) => {
      if (idx === 0 || idx === sorted.length - 1) return; // skip first and last
      if (!w.editableProperties.y) return;
      currentY += (sorted[idx - 1].editableProperties.height?.value ?? 0) + spacing;
      updates[w.id] = { y: currentY };
    });

    batchWidgetUpdate(updates);
  }, [selectedWidgets, batchWidgetUpdate]);

  /**
   * Match width of all selected widgets to the first selected widget.
   */
  const matchWidth = useCallback(() => {
    if (selectedWidgets.length < 2) return;
    const refWidget = selectedWidgets.find((w) => w.id === selectedWidgetIDs[0]);
    const refWidth = refWidget?.editableProperties.width?.value;
    if (refWidth === undefined) return;
    const updates: MultiWidgetPropertyUpdates = {};
    selectedWidgets.forEach((w) => {
      if (!w.editableProperties.width) return;
      updates[w.id] = { width: refWidth };
    });
    batchWidgetUpdate(updates);
  }, [selectedWidgets, selectedWidgetIDs, batchWidgetUpdate]);

  /**
   * Match height of all selected widgets to the first selected widget.
   */
  const matchHeight = useCallback(() => {
    if (selectedWidgets.length < 2) return;
    const refWidget = selectedWidgets.find((w) => w.id === selectedWidgetIDs[0]);
    const refHeight = refWidget?.editableProperties.height?.value;
    if (refHeight === undefined) return;
    const updates: MultiWidgetPropertyUpdates = {};
    selectedWidgets.forEach((w) => {
      if (!w.editableProperties.height) return;
      updates[w.id] = { height: refHeight };
    });
    batchWidgetUpdate(updates);
  }, [selectedWidgets, selectedWidgetIDs, batchWidgetUpdate]);

  /**
   * Move all selected widgets by dx, dy.
   */
  const moveSelected = useCallback(
    (dx: number, dy: number) => {
      if (selectedWidgets.length === 0) return;
      const updates: MultiWidgetPropertyUpdates = {};
      for (const w of selectedWidgets) {
        const { x, y } = w.editableProperties;
        if (!x || !y) continue;
        updates[w.id] = {
          x: x.value + dx,
          y: y.value + dy,
        };
      }
      batchWidgetUpdate(updates);
    },
    [selectedWidgets, batchWidgetUpdate],
  );

  /**
   * Undo the last editor state change.
   */
  const handleUndo = useCallback(() => {
    const currentState = deepCloneWidgetList(editorWidgets);
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const previousState = prevUndo[prevUndo.length - 1];
      setEditorWidgets(previousState);
      return prevUndo.slice(0, -1);
    });
    setRedoStack((prevRedo) => {
      if (undoStack.length === 0) return prevRedo;
      const updatedRedo = [...prevRedo, currentState];
      return updatedRedo.length > MAX_HISTORY ? updatedRedo.slice(1) : updatedRedo;
    });
  }, [editorWidgets, undoStack]);

  /**
   * Redo the last editor state change.
   */
  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const nextState = prevRedo[prevRedo.length - 1];
      setEditorWidgets(nextState);
      return prevRedo.slice(0, -1);
    });
    setUndoStack((prevUndo) => {
      if (redoStack.length == 0) return prevUndo;
      const updatedUndo = [...prevUndo, deepCloneWidgetList(editorWidgets)];
      return updatedUndo.length > MAX_HISTORY ? updatedUndo.slice(1) : updatedUndo;
    });
  }, [editorWidgets, redoStack]);

  /**
   * Copy currently selected widgets to clipboard.
   * @note the widget clipboard is managed internally. The actual system clipboard is not used here.
   */
  const copyWidget = useCallback(() => {
    if (selectedWidgets.length === 0) return;
    if (selectedWidgets.length > 1 && selectionBounds) {
      copiedSelectionBounds.current = selectionBounds;
    }
    clipboard.current = selectedWidgets
      .filter((w) => w !== undefined)
      .map((w) => {
        return deepCloneWidget(w);
      });
  }, [selectedWidgets, selectionBounds]);

  /**
   * Paste widgets from clipboard at a specified grid position.
   * @param pos Position to paste widgets at
   */
  const pasteWidget = useCallback(
    (pos: GridPosition) => {
      if (clipboard.current.length === 0) return;

      const pastingGroup = clipboard.current.length > 1;
      const baseX = pastingGroup
        ? copiedSelectionBounds.current.x
        : clipboard.current[0].editableProperties.x!.value;
      const baseY = pastingGroup
        ? copiedSelectionBounds.current.y
        : clipboard.current[0].editableProperties.y!.value;

      const dx = pos.x - baseX;
      const dy = pos.y - baseY;

      const cloneWidgetWithNewIds = (widget: Widget, dxOffset = 0, dyOffset = 0): Widget => {
        const newId = `${widget.widgetName}-${uuidv4()}`;
        const newEditableProps: Widget["editableProperties"] = Object.fromEntries(
          Object.entries(widget.editableProperties).map(([k, v]) => [k, { ...v }]),
        );

        if (newEditableProps.x) newEditableProps.x.value += dxOffset;
        if (newEditableProps.y) newEditableProps.y.value += dyOffset;

        const newChildren = widget.children?.map((child) =>
          cloneWidgetWithNewIds(child, dxOffset, dyOffset),
        );

        return {
          ...widget,
          id: newId,
          editableProperties: newEditableProps,
          children: newChildren,
        };
      };

      const newWidgets = clipboard.current.map((w) => cloneWidgetWithNewIds(w, dx, dy));

      updateEditorWidgetList((prev) => [...prev, ...newWidgets]);
      setSelectedWidgetIDs(newWidgets.map((w) => w.id));
    },
    [updateEditorWidgetList, copiedSelectionBounds],
  );

  const formatWdgToExport = useCallback((widget: Widget): ExportedWidget => {
    // EmbeddedDisplay children are injected dynamically at runtime — omit them from export.
    const exportChildren =
      widget.widgetName === "EmbeddedDisplay"
        ? undefined
        : widget.children?.map((child) => formatWdgToExport(child));
    return {
      widgetName: widget.widgetName,
      properties: Object.fromEntries(
        Object.entries(widget.editableProperties).map(([key, def]) => [key, def.value]),
      ),
      ...(widget.rules?.length
        ? {
            rules: widget.rules.map(
              ({ id: _id, pvNames: _pv, conditionLogic, ...rest }): ExportedRule =>
                conditionLogic === "OR" ? { conditionLogic, ...rest } : rest,
            ),
          }
        : {}),
      children: exportChildren,
    };
  }, []);

  /**
   * Export current widgets to JSON file.
   */
  const downloadWidgets = useCallback(
    async (suggestedName?: string) => {
      const defaultName = suggestedName ?? "weiss.opi.json";

      const simplified = editorWidgets.map(formatWdgToExport);

      const dataStr = JSON.stringify(simplified, null, 2) + "\n"; // end data with empty line
      const blob = new Blob([dataStr], { type: "application/json" });

      // Extend the Window type locally with File System Access API
      interface FileSystemWindow extends Window {
        showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
      }
      const fsWindow = window as FileSystemWindow;

      if (fsWindow.showSaveFilePicker) {
        try {
          const handle = await fsWindow.showSaveFilePicker({
            suggestedName: defaultName,
            types: [
              {
                description: "OPI Files",
                accept: { "application/json": [".opi.json"] },
              },
            ],
          });

          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (err) {
          if ((err as DOMException).name === "AbortError") {
            return;
          }
          console.error("Failed to save via File System Access API", err);
        }
      }

      // Fallback for browsers that dont support file system interaction
      const filename = prompt("Enter filename:", defaultName);
      if (filename === null) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [editorWidgets, formatWdgToExport],
  );

  /**
   * Load widgets from JSON or ExportedWidget array.
   * @param widgetsData JSON string or array of ExportedWidget
   */
  const loadWidgets = useCallback(
    (widgetsData: string | ExportedWidget[]) => {
      const warnings: string[] = [];

      try {
        const parsed: ExportedWidget[] =
          typeof widgetsData === "string" ? JSON.parse(widgetsData) : widgetsData;

        const restoreWidget = (raw: ExportedWidget, idx?: number): Widget | null => {
          let instance: Widget | null;

          const isGroup = raw.widgetName === "Group";

          if (idx === 0 && raw.widgetName === "GridZone") {
            instance = createWidgetInstance(GridZone, GRID_ID);
          } else if (isGroup) {
            instance = createGroupWidget(uuidv4());
          } else {
            const baseWdg = WidgetRegistry[raw.widgetName];
            if (!baseWdg) {
              warnings.push(`Unknown widget type "${raw.widgetName}" — skipped`);
              return null;
            }
            instance = createWidgetInstance(baseWdg, `${raw.widgetName}-${uuidv4()}`);
          }

          // Recursively restore children
          if (raw.children && raw.children.length > 0) {
            instance.children = raw.children
              .map((child) => restoreWidget(child))
              .filter((c): c is Widget => c !== null);
          }

          // Overlay properties
          for (const [key, val] of Object.entries(raw.properties ?? {})) {
            const propName = key as PropertyKey;
            if (instance.editableProperties[propName]) {
              instance.editableProperties[propName].value = val;
            } else {
              warnings.push(`Unknown property "${key}" on widget "${raw.widgetName}" — ignored`);
            }
          }

          // Restore rules: reconstruct runtime-only fields stripped from the export
          if (raw.rules?.length) {
            instance.rules = raw.rules.map(
              (r): Rule => ({
                ...r,
                id: uuidv4(),
                pvNames: derivePVNames(r.conditions),
              }),
            );
          }

          return instance;
        };

        const imported = parsed
          .map((raw, idx) => restoreWidget(raw, idx))
          .filter((w): w is Widget => w !== null);

        // Snapshot edit-mode macros so they can be restored when returning to edit mode
        editModeMacrosRef.current =
          imported.find((w) => w.id === GRID_ID)?.editableProperties.macros?.value ?? {};

        updateEditorWidgetList(imported, false);
        setSelectedWidgetIDs([]);
        setFileLoadedTrig((t) => t + 1);
        setUndoStack([]);
        setRedoStack([]);

        if (warnings.length > 0) {
          notifyUser(
            `File loaded with ${warnings.length} warning(s):\n ${warnings.join("\n ")}`,
            "warning",
          );
        }
      } catch (err) {
        notifyUser(`Failed to load file: invalid JSON or unexpected format`, "error");
        console.error("Failed to load widgets:", err);
      }
    },
    [updateEditorWidgetList],
  );

  /**
   * Loads widgets from local file, also triggering backend auto-save.
   */
  const importWidgets = useCallback(
    (widgetsData: string | ExportedWidget[]) => {
      loadWidgets(widgetsData);
      setFileImportedTrig((t) => t + 1);
    },
    [loadWidgets],
  );

  /**
   * Replace the rules list for a single widget.
   * Recurses into group children so nested widgets are found correctly.
   * Participates in undo/redo automatically via updateEditorWidgetList.
   */
  const updateWidgetRules = useCallback(
    (id: string, rules: Rule[]) => {
      const applyNested = (widgets: Widget[]): Widget[] =>
        widgets.map((w) => {
          if (w.id === id) return { ...w, rules };
          if (!w.children?.length) return w;
          const updatedChildren = applyNested(w.children);
          if (updatedChildren.every((c, i) => c === w.children![i])) return w;
          return { ...w, children: updatedChildren };
        });
      updateEditorWidgetList(applyNested(editorWidgets));
    },
    [editorWidgets, updateEditorWidgetList],
  );

  /**
   * Replace the rules list for multiple widgets at once (single undo entry).
   * All specified widgets receive an identical copy of `rules`.
   * Recurses into group children so nested widgets are found correctly.
   */
  const batchUpdateWidgetRules = useCallback(
    (ids: string[], rules: Rule[]) => {
      const idSet = new Set(ids);
      const applyNested = (widgets: Widget[]): Widget[] =>
        widgets.map((w) => {
          if (idSet.has(w.id)) return { ...w, rules };
          if (!w.children?.length) return w;
          const updatedChildren = applyNested(w.children);
          if (updatedChildren.every((c, i) => c === w.children![i])) return w;
          return { ...w, children: updatedChildren };
        });
      updateEditorWidgetList(applyNested(editorWidgets));
    },
    [editorWidgets, updateEditorWidgetList],
  );

  /**
   * Snapshot of GridZone macros at the moment runtime mode was last entered.
   * Used to restore edit-mode macros when switching back to edit mode,
   * preventing rule-driven runtime overrides from persisting.
   */
  const editModeMacrosRef = useRef<Record<string, string>>({});

  const snapshotEditModeMacros = useCallback(() => {
    editModeMacrosRef.current = getWidget(GRID_ID)?.editableProperties.macros?.value ?? {};
  }, [getWidget]);

  const restoreEditModeMacros = useCallback(() => {
    updateWidgetProperties(GRID_ID, { macros: editModeMacrosRef.current }, false);
  }, [updateWidgetProperties]);

  /**
   * Macros to be substituted on pv names.
   * In runtime mode, effectiveGridMacroOverrides (computed by WidgetRenderer from fired rules)
   * are merged on top of the GridZone's design-time macros so that PVMap stays in sync.
   */
  const [effectiveGridMacroOverrides, setEffectiveGridMacroOverrides] = useState<
    Record<string, string>
  >({});
  const baseMacros = getWidget(GRID_ID)?.editableProperties.macros?.value;
  const macros = useMemo(
    () =>
      Object.keys(effectiveGridMacroOverrides).length > 0
        ? { ...(baseMacros ?? {}), ...effectiveGridMacroOverrides }
        : baseMacros,
    [baseMacros, effectiveGridMacroOverrides],
  );

  /**
   * Helper to substitute macros of the form $(NAME) in a PV string.
   * If a macro key is not found in macros, the original macro text is kept.
   */
  const substituteMacros = useCallback(
    (pv: string): string => (macros ? substituteInStr(pv, macros) : pv),
    [macros],
  );

  /**
   * Map of all PVs held by widgets: { widget PV: macros-substituted PV }
   */
  const PVMap = useMemo(() => {
    const map = new Map<string, string>();

    const collectPVs = (widgets: typeof editorWidgets) => {
      for (const w of widgets) {
        const single = w.editableProperties?.pvName?.value;
        if (single) {
          const substitutedSingle = substituteMacros(single);
          if (substitutedSingle) {
            map.set(single, substitutedSingle);
          }
        }

        const multiPV = w.editableProperties?.pvNames?.value;
        if (multiPV) {
          Object.values(multiPV).forEach((pv) => {
            const substituted = substituteMacros(pv);
            if (substituted) {
              map.set(pv, substituted);
            }
          });
        }

        for (const rule of w.rules ?? []) {
          for (const pv of rule.pvNames) {
            const substituted = substituteMacros(pv);
            if (substituted) {
              map.set(pv, substituted);
            }
          }
          // Pre-subscribe pvName action targets so EpicsWS is ready before the rule fires
          const pvNameAction = rule.actions?.pvName;
          if (typeof pvNameAction === "string" && pvNameAction) {
            const substituted = substituteMacros(pvNameAction);
            if (substituted) {
              map.set(pvNameAction, substituted);
            }
          }
        }

        if (w.children && w.children.length > 0) {
          collectPVs(w.children);
        }
      }
    };

    collectPVs(editorWidgets);
    return map;
  }, [editorWidgets, substituteMacros]);

  return {
    editorWidgets,
    setEditorWidgets,
    selectedWidgetIDs,
    editingWidgets,
    selectionBounds,
    undoStack,
    redoStack,
    setSelectedWidgetIDs,
    selectedWidgets,
    updateEditorWidgetList,
    batchWidgetUpdate,
    getWidget,
    addWidget,
    deleteWidget,
    clearAllWidgets,
    computeGroupBounds,
    groupSelected,
    ungroupSelected,
    copyWidget,
    pasteWidget,
    updateWidgetProperties,
    updateWidgetChildren,
    stepForward,
    stepBackwards,
    bringToFront,
    sendToBack,
    handleRedo,
    handleUndo,
    alignLeft,
    alignRight,
    alignTop,
    alignBottom,
    alignHorizontalCenter,
    alignVerticalCenter,
    distributeHorizontal,
    distributeVertical,
    matchWidth,
    matchHeight,
    moveSelected,
    downloadWidgets,
    loadWidgets,
    importWidgets,
    fileImportedTrig,
    updateWidgetRules,
    batchUpdateWidgetRules,
    PVMap,
    macros,
    allWidgetIDs,
    formatWdgToExport,
    fileLoadedTrig,
    pickedWidget,
    setPickedWidget,
    isPlacementMode,
    setIsPlacementMode,
    snapshotEditModeMacros,
    restoreEditModeMacros,
    setEffectiveGridMacroOverrides,
  };
}
