// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { create } from "zustand";
import type {
  Widget,
  WidgetDefinition,
  PropertyUpdates,
  PropertyKey,
  MultiWidgetPropertyUpdates,
  GridPosition,
  ExportedWidget,
  ExportedRule,
  DOMRectLike,
  Rule,
} from "@src/types/widgets";
import type { DraggableData, Position, RndDragEvent } from "react-rnd";
import { v4 as uuidv4 } from "uuid";
import { GridZone } from "@components/GridZone";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import { GRID_ID, MAX_HISTORY } from "@src/constants/constants";
import { notifyUser } from "@src/services/Notifications/Notification";
import {
  composeForwardNavigationMacros,
  resolveMacroRecord,
  substituteMacroInStr,
} from "@src/utils/macros";
import { collectRulePVNames, parseSerializedRules } from "@src/utils/ruleCompatibility";
import {
  createGroupWidget,
  createWidgetInstance,
  deepCloneWidget,
  deepCloneWidgetList,
  ensureGridCoordinate,
  getTopLevelId,
  getNestedMoveUpdates,
  getSelectedWidgets,
  getWidgetNested,
  updateWidgets,
} from "@src/stores/widgetHelpers";

type Macros = Record<string, string>;

const DRAG_END_DELAY = 80; //ms
/** Shared fallback, keeps derived macros referentially stable when the grid has none */
const NO_MACROS: Macros = {};

/** Internal widget clipboard; the system clipboard is not used */
let clipboard: Widget[] = [];
let copiedSelectionBounds: DOMRectLike = { x: 0, y: 0, width: 0, height: 0 };
/**
 * GridZone macros when runtime mode was last entered (or the file loaded). Restored when
 * returning to edit mode, dropping rule-driven runtime overrides.
 */
let editModeMacros: Macros = {};

/** Macro-resolved values of the widget's PV-valued properties (`isPV`), by property name */
function resolveAuxPVs(w: Widget, macros: Macros): Macros | undefined {
  let resolved: Macros | undefined;
  for (const [name, prop] of Object.entries(w.editableProperties ?? {})) {
    if (!prop?.isPV || typeof prop.value !== "string" || !prop.value) continue;
    resolved ??= {};
    resolved[name] = substituteMacroInStr(prop.value, macros);
  }
  return resolved;
}

function sameRecord(a: Macros | undefined, b: Macros | undefined) {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

/** Stamps runtimePVName/runtimePVNames/runtimeAuxPVs; unchanged widgets keep their reference. */
function stampRuntimePVs(w: Widget, macros: Macros): Widget {
  const pvName = w.editableProperties?.pvName?.value;
  const pvNames = w.editableProperties?.pvNames?.value;

  const runtimePVName = pvName ? substituteMacroInStr(pvName, macros) : undefined;
  const runtimePVNames = pvNames?.map((name) => substituteMacroInStr(name, macros));
  const runtimeAuxPVs = resolveAuxPVs(w, macros);
  const children = w.children?.map((c) => stampRuntimePVs(c, macros));

  const pvNameUnchanged = runtimePVName === w.runtimePVName;
  const pvNamesUnchanged =
    (!runtimePVNames && !w.runtimePVNames) ||
    (runtimePVNames?.length === w.runtimePVNames?.length &&
      runtimePVNames?.every((v, i) => v === w.runtimePVNames![i]));
  const childrenUnchanged = !children || children.every((c, i) => c === w.children![i]);
  const auxPVsUnchanged = sameRecord(runtimeAuxPVs, w.runtimeAuxPVs);

  if (pvNameUnchanged && pvNamesUnchanged && childrenUnchanged && auxPVsUnchanged) return w;

  return {
    ...w,
    ...(runtimePVName !== undefined ? { runtimePVName } : {}),
    ...(runtimePVNames !== undefined ? { runtimePVNames } : {}),
    ...(auxPVsUnchanged ? {} : { runtimeAuxPVs }),
    ...(children ? { children } : {}),
  };
}

/**
 * Flat deduplicated list of all resolved PV names that need WebSocket subscriptions:
 * widget runtime PV names plus rule condition/action PV targets.
 */
function collectResolvedPVs(widgets: Widget[], macros: Macros): string[] {
  const pvSet = new Set<string>();
  const addResolved = (pv: unknown) => {
    if (typeof pv !== "string" || !pv) return;
    const substituted = substituteMacroInStr(pv, macros);
    if (substituted) pvSet.add(substituted);
  };
  const collect = (list: Widget[]) => {
    for (const w of list) {
      if (w.runtimePVName) pvSet.add(w.runtimePVName);
      if (w.runtimePVNames) for (const pv of w.runtimePVNames) pvSet.add(pv);
      if (w.runtimeAuxPVs) for (const pv of Object.values(w.runtimeAuxPVs)) pvSet.add(pv);
      for (const rule of w.rules ?? []) {
        for (const pv of collectRulePVNames(rule)) addResolved(pv);
        // Pre-subscribe PV targets when a rule can switch pvName/pvNames
        if (rule.targetProperty === "pvName") {
          for (const ruleset of rule.rulesets) addResolved(ruleset.value);
        }
        if (rule.targetProperty === "pvNames") {
          for (const ruleset of rule.rulesets) {
            if (Array.isArray(ruleset.value)) ruleset.value.forEach(addResolved);
          }
        }
      }
      if (w.children?.length) collect(w.children);
    }
  };
  collect(widgets);
  return [...pvSet];
}

function buildWidgetIdMap(widgets: Widget[]): Map<string, Widget> {
  const map = new Map<string, Widget>();
  const traverse = (list: Widget[]) => {
    for (const w of list) {
      if (w.id !== GRID_ID) map.set(w.id, w);
      if (w.children) traverse(w.children);
    }
  };
  traverse(widgets);
  return map;
}

function computeGroupBounds(widgets: Widget[]): DOMRectLike | null {
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
}

function pushHistory(stack: Widget[][], widgets: Widget[]): Widget[][] {
  const updated = [...stack, deepCloneWidgetList(widgets)];
  return updated.length > MAX_HISTORY ? updated.slice(1) : updated;
}

/** File content of a widget list, as saved and downloaded */
export function serializeWidgets(widgets: Widget[]): string {
  return JSON.stringify(widgets.map(formatWdgToExport), null, 2);
}

function formatWdgToExport(widget: Widget): ExportedWidget {
  // EmbeddedDisplay/NavigationTabs children are injected at runtime and not exported
  const exportChildren =
    widget.widgetName === "EmbeddedDisplay" || widget.widgetName === "NavigationTabs"
      ? undefined
      : widget.children?.map(formatWdgToExport);
  return {
    widgetName: widget.widgetName,
    properties: Object.fromEntries(
      Object.entries(widget.editableProperties).map(([key, def]) => [key, def.value]),
    ),
    ...(widget.rules?.length
      ? {
          rules: widget.rules.map(({ id: _id, rulesets, ...rest }): ExportedRule => ({
            ...rest,
            rulesets: rulesets.map(
              ({ id: _rulesetId, pvNames: _pvNames, conditionLogic, ...ruleset }) =>
                conditionLogic === "OR" ? { conditionLogic, ...ruleset } : ruleset,
            ),
          })),
        }
      : {}),
    children: exportChildren,
  };
}

/** Fields computed by `commit` */
type DerivedState = Pick<
  EditorState,
  | "editorWidgets"
  | "navMacroOverrides"
  | "ruleMacroOverrides"
  | "widgetIdMap"
  | "allWidgetIDs"
  | "selectedWidgets"
  | "selectionBounds"
  | "editingWidgets"
  | "gridSize"
  | "snapToGrid"
  | "baseGlobalMacros"
  | "runtimeBaseMacros"
  | "globalMacros"
  | "resolvedPVList"
>;

interface EditorState {
  /** Flat list of top-level widgets, the grid at index 0 */
  editorWidgets: Widget[];
  selectedWidgetIDs: string[];
  undoStack: Widget[][];
  redoStack: Widget[][];
  /** Widget picked from the palette */
  pickedWidget: WidgetDefinition | null;
  isPlacementMode: boolean;
  isDragging: boolean;
  /** Incremented on every file load */
  fileLoadedTrig: number;
  /** Exported content last loaded or saved; auto-save skips identical content. null after an import. */
  savedContent: string | null;
  /** Macros forwarded by navigation actions (runtime only) */
  navMacroOverrides: Macros;
  /** Macros set by rules from live PV data (runtime only) */
  ruleMacroOverrides: Macros;

  // Derived in commit(); never set directly
  /** All widgets by id, nested ones included, the grid excluded */
  widgetIdMap: Map<string, Widget>;
  /** Top-level widget ids, the grid excluded */
  allWidgetIDs: string[];
  selectedWidgets: Widget[];
  selectionBounds: DOMRectLike | null;
  /** Widgets shown in the property editor: the selection, or the grid */
  editingWidgets: Widget[];
  gridSize: number;
  snapToGrid: boolean;
  /** Grid macros (design time) */
  baseGlobalMacros: Macros;
  /** Grid macros plus navigation overrides, resolved against each other */
  runtimeBaseMacros: Macros;
  /** Runtime base macros plus rule overrides; used by widgets and PV resolution */
  globalMacros: Macros;
  /** Resolved PV names to subscribe to */
  resolvedPVList: string[];

  /** Replaces the widget list; records undo history unless `keepHistory` is false. */
  updateEditorWidgetList: (
    newWidgets: Widget[] | ((prev: Widget[]) => Widget[]),
    keepHistory?: boolean,
  ) => void;
  setSelectedWidgetIDs: (ids: string[]) => void;
  getWidget: (id: string) => Widget | undefined;
  batchWidgetUpdate: (updates: MultiWidgetPropertyUpdates, keepHistory?: boolean) => void;
  updateWidgetProperties: (id: string, changes: PropertyUpdates, keepHistory?: boolean) => void;
  /** Replaces the children of a widget, nested ones included. No history by default. */
  updateWidgetChildren: (id: string, children: Widget[], keepHistory?: boolean) => void;
  updateWidgetRules: (id: string, rules: Rule[]) => void;
  /** Gives every widget in `ids` the same rules (single undo entry) */
  batchUpdateWidgetRules: (ids: string[], rules: Rule[]) => void;
  /** Adds a widget; an empty alias becomes "{widgetLabel} {n}". */
  addWidget: (newWidget: Widget) => void;
  deleteWidget: () => void;
  clearAllWidgets: () => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  stepForward: () => void;
  stepBackwards: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  alignLeft: () => void;
  alignRight: () => void;
  alignTop: () => void;
  alignBottom: () => void;
  alignHorizontalCenter: () => void;
  alignVerticalCenter: () => void;
  distributeHorizontal: () => void;
  distributeVertical: () => void;
  /** Matches the width of the selection to the first selected widget */
  matchWidth: () => void;
  matchHeight: () => void;
  moveSelected: (dx: number, dy: number) => void;
  /** Selects one widget on pointer-down; nested ids are promoted to their top-level widget. */
  selectSingleWidgetImmediate: (widgetId: string) => void;
  /** Toggles a widget in the selection (ctrl-click). */
  toggleWidgetSelectionImmediate: (widgetId: string) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  copyWidget: () => void;
  pasteWidget: (pos: GridPosition) => void;
  downloadWidgets: (suggestedName?: string) => Promise<void>;
  loadWidgets: (widgetsData: string | ExportedWidget[]) => void;
  /** Loads widgets from a local file, also triggering the backend auto-save. */
  importWidgets: (widgetsData: string | ExportedWidget[]) => void;
  setSavedContent: (content: string) => void;
  setPickedWidget: (widget: WidgetDefinition | null) => void;
  setIsPlacementMode: (isPlacementMode: boolean) => void;
  setIsDragging: (isDragging: boolean) => void;
  handleDragStop: (e: RndDragEvent, d: DraggableData, w: Widget) => void;
  handleResizeStop: (ref: HTMLElement, position: Position, w: Widget) => void;
  handleSelGroupDragStop: (dx: number, dy: number) => void;
  handleSelGroupResizeStop: (ref: HTMLElement, bounds: DOMRectLike, widgets: Widget[]) => void;
  snapshotEditModeMacros: () => void;
  restoreEditModeMacros: () => void;
  /** Forwards navigation macros: button macros go on top of the inherited ones. */
  forwardNavigationMacros: (macros: Macros) => void;
  setRuleMacroOverrides: (macros: Macros) => void;
  resetRuntimeMacros: () => void;
}

type MacroOverrides = Pick<EditorState, "navMacroOverrides" | "ruleMacroOverrides">;
/** State `commit` reads; the derived macros are missing on the first commit */
type CommitPrev = MacroOverrides &
  Pick<EditorState, "selectedWidgetIDs"> &
  Partial<Pick<EditorState, "baseGlobalMacros" | "runtimeBaseMacros" | "globalMacros">>;

/** Macro layers; a layer keeps its previous object when its inputs are unchanged. */
function deriveMacros(widgets: Widget[], prev: CommitPrev, overrides: MacroOverrides) {
  const grid = widgets.find((w) => w.id === GRID_ID);
  const baseGlobalMacros = grid?.editableProperties.macros?.value ?? NO_MACROS;
  const { navMacroOverrides: nav, ruleMacroOverrides: rule } = overrides;

  let runtimeBaseMacros = prev.runtimeBaseMacros;
  if (
    !runtimeBaseMacros ||
    baseGlobalMacros !== prev.baseGlobalMacros ||
    nav !== prev.navMacroOverrides
  ) {
    // Grid macro values may reference macros inherited from navigation
    const merged = Object.keys(nav).length > 0 ? { ...baseGlobalMacros, ...nav } : baseGlobalMacros;
    runtimeBaseMacros = resolveMacroRecord(merged, merged);
  }
  let globalMacros = prev.globalMacros;
  if (
    !globalMacros ||
    runtimeBaseMacros !== prev.runtimeBaseMacros ||
    rule !== prev.ruleMacroOverrides
  ) {
    globalMacros =
      Object.keys(rule).length > 0 ? { ...runtimeBaseMacros, ...rule } : runtimeBaseMacros;
  }
  return {
    navMacroOverrides: nav,
    ruleMacroOverrides: rule,
    baseGlobalMacros,
    runtimeBaseMacros,
    globalMacros,
  };
}

function deriveSelection(widgetIdMap: Map<string, Widget>, widgets: Widget[], ids: string[]) {
  const selectedWidgets = getSelectedWidgets(widgets, ids);
  return {
    selectedWidgets,
    selectionBounds: computeGroupBounds(
      ids.map((id) => widgetIdMap.get(id)).filter((w): w is Widget => w !== undefined),
    ),
    editingWidgets:
      selectedWidgets.length > 0
        ? selectedWidgets
        : [widgets.find((w) => w.id === GRID_ID) ?? widgets[0]],
  };
}

/**
 * State derived from a new widget list and macro overrides: macros, stamped runtime PV names,
 * indices and selection. Every change of `editorWidgets` or of the overrides goes through it.
 */
function commit(
  widgets: Widget[],
  prev: CommitPrev,
  overrides: MacroOverrides = prev,
): DerivedState {
  const macros = deriveMacros(widgets, prev, overrides);
  const stamped = widgets.map((w) => stampRuntimePVs(w, macros.globalMacros));
  const editorWidgets = stamped.some((w, i) => w !== widgets[i]) ? stamped : widgets;
  const widgetIdMap = buildWidgetIdMap(editorWidgets);
  const gridProps = editorWidgets.find((w) => w.id === GRID_ID)?.editableProperties;
  return {
    editorWidgets,
    ...macros,
    widgetIdMap,
    allWidgetIDs: editorWidgets.map((w) => w.id).filter((id) => id !== GRID_ID),
    gridSize: gridProps?.gridSize?.value ?? 1,
    snapToGrid: gridProps?.snapToGrid?.value ?? true,
    resolvedPVList: collectResolvedPVs(editorWidgets, macros.globalMacros),
    ...deriveSelection(widgetIdMap, editorWidgets, prev.selectedWidgetIDs),
  };
}

// GridZone imports GridZoneComp, which imports this store: this module has to be evaluated
// first (main.tsx imports AppEffects, which reaches it, before App).
const initialState = commit([createWidgetInstance(GridZone, GRID_ID)], {
  navMacroOverrides: NO_MACROS,
  ruleMacroOverrides: NO_MACROS,
  selectedWidgetIDs: [],
});

export const useEditorStore = create<EditorState>()((set, get) => {
  /** Applies updates, propagating position/size changes of groups to their children. */
  const batchWidgetUpdate = (updates: MultiWidgetPropertyUpdates, keepHistory = true) => {
    for (const id of Object.keys(updates)) {
      const w = get().getWidget(id);
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
    get().updateEditorWidgetList((prev) => updateWidgets(prev, updates), keepHistory);
  };

  const setSelection = (ids: string[]) => {
    const s = get();
    set({
      selectedWidgetIDs: ids,
      ...deriveSelection(s.widgetIdMap, s.editorWidgets, ids),
    });
  };

  const setMacroOverrides = (overrides: Partial<MacroOverrides>) => {
    const s = get();
    set(commit(s.editorWidgets, s, { ...s, ...overrides }));
  };

  const reorderWidgets = (direction: "forward" | "backward" | "front" | "back") => {
    const { selectedWidgetIDs } = get();
    if (selectedWidgetIDs.length === 0) return;
    get().updateEditorWidgetList((prev) => {
      const [gridZone, ...widgets] = prev;
      const others = widgets.filter((w) => !selectedWidgetIDs.includes(w.id));
      const moving = widgets.filter((w) => selectedWidgetIDs.includes(w.id));
      if (moving.length === 0) return prev;

      let newWidgets: Widget[] = [];
      switch (direction) {
        case "forward": {
          const maxIdx = Math.max(...moving.map((w) => widgets.findIndex((p) => p.id === w.id)));
          const insertPos = Math.min(maxIdx + 1, others.length);
          newWidgets = [...others.slice(0, insertPos), ...moving, ...others.slice(insertPos)];
          break;
        }
        case "backward": {
          const minIdx = Math.min(...moving.map((w) => widgets.findIndex((p) => p.id === w.id)));
          const insertPos = Math.max(minIdx - 1, 0);
          newWidgets = [...others.slice(0, insertPos), ...moving, ...others.slice(insertPos)];
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
  };

  /** Applies `compute` to the selection (at least `min` widgets) as one batch update. */
  const updateSelection = (
    min: number,
    compute: (selected: Widget[]) => MultiWidgetPropertyUpdates,
  ) => {
    const { selectedWidgets } = get();
    if (selectedWidgets.length < min) return;
    const updates = compute(selectedWidgets);
    if (Object.keys(updates).length > 0) batchWidgetUpdate(updates);
  };

  const right = (w: Widget) =>
    (w.editableProperties.x?.value ?? 0) + (w.editableProperties.width?.value ?? 0);
  const bottom = (w: Widget) =>
    (w.editableProperties.y?.value ?? 0) + (w.editableProperties.height?.value ?? 0);

  const applyRules = (ids: Set<string>, rules: Rule[]) => {
    const applyNested = (widgets: Widget[]): Widget[] =>
      widgets.map((w) => {
        if (ids.has(w.id)) return { ...w, rules };
        if (!w.children?.length) return w;
        const updatedChildren = applyNested(w.children);
        if (updatedChildren.every((c, i) => c === w.children![i])) return w;
        return { ...w, children: updatedChildren };
      });
    get().updateEditorWidgetList(applyNested);
  };

  return {
    selectedWidgetIDs: [],
    undoStack: [],
    redoStack: [],
    pickedWidget: null,
    isPlacementMode: false,
    isDragging: false,
    fileLoadedTrig: 0,
    savedContent: null,
    ...initialState,

    updateEditorWidgetList: (newWidgets, keepHistory = true) => {
      const s = get();
      const widgets = typeof newWidgets === "function" ? newWidgets(s.editorWidgets) : newWidgets;
      if (widgets === s.editorWidgets) return;
      set({
        ...(keepHistory
          ? { undoStack: pushHistory(s.undoStack, s.editorWidgets), redoStack: [] }
          : {}),
        ...commit(widgets, s),
      });
    },

    setSelectedWidgetIDs: setSelection,

    getWidget: (id) => getWidgetNested(get().editorWidgets, id),

    batchWidgetUpdate,

    updateWidgetProperties: (id, changes, keepHistory = true) =>
      batchWidgetUpdate({ [id]: changes }, keepHistory),

    updateWidgetChildren: (id, children, keepHistory = false) => {
      get().updateEditorWidgetList((prev) => {
        const replace = (widgets: Widget[]): [Widget[], boolean] => {
          let changed = false;
          const next = widgets.map((w) => {
            if (w.id === id) {
              if (w.children === children) return w;
              changed = true;
              return { ...w, children };
            }
            if (!w.children?.length) return w;
            const [updatedChildren, childChanged] = replace(w.children);
            if (!childChanged) return w;
            changed = true;
            return { ...w, children: updatedChildren };
          });
          return changed ? [next, true] : [widgets, false];
        };
        return replace(prev)[0];
      }, keepHistory);
    },

    updateWidgetRules: (id, rules) => applyRules(new Set([id]), rules),

    batchUpdateWidgetRules: (ids, rules) => applyRules(new Set(ids), rules),

    addWidget: (newWidget) => {
      get().updateEditorWidgetList((prev) => {
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

    deleteWidget: () => {
      const { selectedWidgetIDs } = get();
      get().updateEditorWidgetList((prev) => prev.filter((w) => !selectedWidgetIDs.includes(w.id)));
      setSelection([]);
    },

    clearAllWidgets: () => {
      const s = get();
      set({
        ...commit([createWidgetInstance(GridZone, GRID_ID)], { ...s, selectedWidgetIDs: [] }),
        selectedWidgetIDs: [],
      });
    },

    groupSelected: () => {
      const { selectedWidgetIDs, selectionBounds, selectedWidgets } = get();
      if (selectedWidgetIDs.length < 2 || !selectionBounds) return;
      const groupID = uuidv4();
      const groupWidget = createGroupWidget(groupID, selectedWidgets, selectionBounds);
      get().updateEditorWidgetList((prev) => [
        ...prev.filter((w) => !selectedWidgetIDs.includes(w.id)),
        groupWidget,
      ]);
      setSelection([groupID]);
    },

    ungroupSelected: () => {
      const { selectedWidgetIDs } = get();
      get().updateEditorWidgetList((prev) =>
        prev.flatMap((w) =>
          selectedWidgetIDs.includes(w.id) &&
          w.children &&
          w.widgetName !== "EmbeddedDisplay" &&
          w.widgetName !== "NavigationTabs"
            ? w.children
            : [w],
        ),
      );
      setSelection([]);
    },

    stepForward: () => reorderWidgets("forward"),
    stepBackwards: () => reorderWidgets("backward"),
    bringToFront: () => reorderWidgets("front"),
    sendToBack: () => reorderWidgets("back"),

    alignLeft: () =>
      updateSelection(2, (sel) => {
        const leftX = Math.min(...sel.map((w) => w.editableProperties.x?.value ?? 0));
        return Object.fromEntries(sel.map((w) => [w.id, { x: leftX }]));
      }),

    alignRight: () =>
      updateSelection(2, (sel) => {
        const rightX = Math.max(...sel.map(right));
        const updates: MultiWidgetPropertyUpdates = {};
        for (const w of sel) {
          if (!w.editableProperties.x || !w.editableProperties.width) continue;
          updates[w.id] = { x: rightX - w.editableProperties.width.value };
        }
        return updates;
      }),

    alignTop: () =>
      updateSelection(2, (sel) => {
        const topY = Math.min(...sel.map((w) => w.editableProperties.y?.value ?? 0));
        return Object.fromEntries(sel.map((w) => [w.id, { y: topY }]));
      }),

    alignBottom: () =>
      updateSelection(2, (sel) => {
        const bottomY = Math.max(...sel.map(bottom));
        const updates: MultiWidgetPropertyUpdates = {};
        for (const w of sel) {
          if (!w.editableProperties.y || !w.editableProperties.height) continue;
          updates[w.id] = { y: bottomY - w.editableProperties.height.value };
        }
        return updates;
      }),

    alignHorizontalCenter: () =>
      updateSelection(2, (sel) => {
        const minX = Math.min(...sel.map((w) => w.editableProperties.x?.value ?? 0));
        const centerX = (minX + Math.max(...sel.map(right))) / 2;
        const updates: MultiWidgetPropertyUpdates = {};
        for (const w of sel) {
          if (!w.editableProperties.x || !w.editableProperties.width) continue;
          updates[w.id] = { x: centerX - w.editableProperties.width.value / 2 };
        }
        return updates;
      }),

    alignVerticalCenter: () =>
      updateSelection(2, (sel) => {
        const minY = Math.min(...sel.map((w) => w.editableProperties.y?.value ?? 0));
        const centerY = (minY + Math.max(...sel.map(bottom))) / 2;
        const updates: MultiWidgetPropertyUpdates = {};
        for (const w of sel) {
          if (!w.editableProperties.y || !w.editableProperties.height) continue;
          updates[w.id] = { y: centerY - w.editableProperties.height.value / 2 };
        }
        return updates;
      }),

    distributeHorizontal: () =>
      updateSelection(3, (sel) => {
        const sorted = [...sel].sort(
          (a, b) => (a.editableProperties.x?.value ?? 0) - (b.editableProperties.x?.value ?? 0),
        );
        const leftX = sorted[0].editableProperties.x?.value ?? 0;
        const rightX = right(sorted[sorted.length - 1]);
        const totalWidth = sorted.reduce(
          (sum, w) => sum + (w.editableProperties.width?.value ?? 0),
          0,
        );
        const spacing = (rightX - leftX - totalWidth) / (sorted.length - 1);
        let currentX = leftX;
        const updates: MultiWidgetPropertyUpdates = {};
        sorted.forEach((w, idx) => {
          if (idx === 0 || idx === sorted.length - 1) return; // first and last stay
          if (!w.editableProperties.x) return;
          currentX += (sorted[idx - 1].editableProperties.width?.value ?? 0) + spacing;
          updates[w.id] = { x: currentX };
        });
        return updates;
      }),

    distributeVertical: () =>
      updateSelection(3, (sel) => {
        const sorted = [...sel].sort(
          (a, b) => (a.editableProperties.y?.value ?? 0) - (b.editableProperties.y?.value ?? 0),
        );
        const topY = sorted[0].editableProperties.y?.value ?? 0;
        const bottomY = bottom(sorted[sorted.length - 1]);
        const totalHeight = sorted.reduce(
          (sum, w) => sum + (w.editableProperties.height?.value ?? 0),
          0,
        );
        const spacing = (bottomY - topY - totalHeight) / (sorted.length - 1);
        let currentY = topY;
        const updates: MultiWidgetPropertyUpdates = {};
        sorted.forEach((w, idx) => {
          if (idx === 0 || idx === sorted.length - 1) return; // first and last stay
          if (!w.editableProperties.y) return;
          currentY += (sorted[idx - 1].editableProperties.height?.value ?? 0) + spacing;
          updates[w.id] = { y: currentY };
        });
        return updates;
      }),

    matchWidth: () =>
      updateSelection(2, (sel) => {
        const refWidth = sel.find((w) => w.id === get().selectedWidgetIDs[0])?.editableProperties
          .width?.value;
        if (refWidth === undefined) return {};
        return Object.fromEntries(
          sel.filter((w) => w.editableProperties.width).map((w) => [w.id, { width: refWidth }]),
        );
      }),

    matchHeight: () =>
      updateSelection(2, (sel) => {
        const refHeight = sel.find((w) => w.id === get().selectedWidgetIDs[0])?.editableProperties
          .height?.value;
        if (refHeight === undefined) return {};
        return Object.fromEntries(
          sel.filter((w) => w.editableProperties.height).map((w) => [w.id, { height: refHeight }]),
        );
      }),

    moveSelected: (dx, dy) =>
      updateSelection(1, (sel) => {
        const updates: MultiWidgetPropertyUpdates = {};
        for (const w of sel) {
          const { x, y } = w.editableProperties;
          if (!x || !y) continue;
          updates[w.id] = { x: x.value + dx, y: y.value + dy };
        }
        return updates;
      }),

    selectSingleWidgetImmediate: (widgetId) => {
      const { editorWidgets, selectedWidgetIDs } = get();
      const effectiveId = getTopLevelId(editorWidgets, widgetId);
      const normalized = selectedWidgetIDs.map((id) => getTopLevelId(editorWidgets, id));
      if (normalized.length === 1 && normalized[0] === effectiveId) return;
      setSelection([effectiveId]);
    },

    toggleWidgetSelectionImmediate: (widgetId) => {
      const { editorWidgets, selectedWidgetIDs } = get();
      const effectiveId = getTopLevelId(editorWidgets, widgetId);
      const normalized = selectedWidgetIDs.map((id) => getTopLevelId(editorWidgets, id));
      setSelection(
        normalized.includes(effectiveId)
          ? normalized.filter((id) => id !== effectiveId)
          : [...normalized, effectiveId],
      );
    },

    handleUndo: () => {
      const s = get();
      if (s.undoStack.length === 0) return;
      const redoStack = pushHistory(s.redoStack, s.editorWidgets);
      set({ undoStack: s.undoStack.slice(0, -1), redoStack, ...commit(s.undoStack.at(-1)!, s) });
    },

    handleRedo: () => {
      const s = get();
      if (s.redoStack.length === 0) return;
      const undoStack = pushHistory(s.undoStack, s.editorWidgets);
      set({ redoStack: s.redoStack.slice(0, -1), undoStack, ...commit(s.redoStack.at(-1)!, s) });
    },

    copyWidget: () => {
      const { selectedWidgets, selectionBounds } = get();
      if (selectedWidgets.length === 0) return;
      if (selectedWidgets.length > 1 && selectionBounds) copiedSelectionBounds = selectionBounds;
      clipboard = selectedWidgets.map(deepCloneWidget);
    },

    pasteWidget: (pos) => {
      if (clipboard.length === 0) return;
      const pastingGroup = clipboard.length > 1;
      const baseX = pastingGroup
        ? copiedSelectionBounds.x
        : clipboard[0].editableProperties.x!.value;
      const baseY = pastingGroup
        ? copiedSelectionBounds.y
        : clipboard[0].editableProperties.y!.value;
      const dx = pos.x - baseX;
      const dy = pos.y - baseY;

      const cloneWithNewIds = (widget: Widget): Widget => {
        const editableProperties: Widget["editableProperties"] = Object.fromEntries(
          Object.entries(widget.editableProperties).map(([k, v]) => [k, { ...v }]),
        );
        if (editableProperties.x) editableProperties.x.value += dx;
        if (editableProperties.y) editableProperties.y.value += dy;
        return {
          ...widget,
          id: `${widget.widgetName}-${uuidv4()}`,
          editableProperties,
          children: widget.children?.map(cloneWithNewIds),
        };
      };

      const newWidgets = clipboard.map(cloneWithNewIds);
      get().updateEditorWidgetList((prev) => [...prev, ...newWidgets]);
      setSelection(newWidgets.map((w) => w.id));
    },

    downloadWidgets: async (suggestedName) => {
      const defaultName = suggestedName ?? "weiss.opi.json";
      const dataStr = serializeWidgets(get().editorWidgets) + "\n"; // end data with empty line
      const blob = new Blob([dataStr], { type: "application/json" });

      // File System Access API, not in the standard Window type
      interface FileSystemWindow extends Window {
        showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
      }
      const fsWindow = window as FileSystemWindow;

      if (fsWindow.showSaveFilePicker) {
        try {
          const handle = await fsWindow.showSaveFilePicker({
            suggestedName: defaultName,
            types: [{ description: "OPI Files", accept: { "application/json": [".opi.json"] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (err) {
          if ((err as DOMException).name === "AbortError") return;
          console.error("Failed to save via File System Access API", err);
        }
      }

      // Fallback for browsers without file system access
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

    loadWidgets: (widgetsData) => {
      const warnings: string[] = [];
      try {
        const parsed: ExportedWidget[] =
          typeof widgetsData === "string" ? JSON.parse(widgetsData) : widgetsData;

        const restoreWidget = (raw: ExportedWidget, idx?: number): Widget | null => {
          let instance: Widget;
          if (idx === 0 && raw.widgetName === "GridZone") {
            instance = createWidgetInstance(GridZone, GRID_ID);
          } else if (raw.widgetName === "Group") {
            instance = createGroupWidget(uuidv4());
          } else {
            const baseWdg = WidgetRegistry[raw.widgetName];
            if (!baseWdg) {
              warnings.push(`Unknown widget type "${raw.widgetName}" — skipped`);
              return null;
            }
            instance = createWidgetInstance(baseWdg, `${raw.widgetName}-${uuidv4()}`);
          }

          if (raw.children && raw.children.length > 0) {
            instance.children = raw.children
              .map((child) => restoreWidget(child))
              .filter((c): c is Widget => c !== null);
          }

          for (const [key, val] of Object.entries(raw.properties ?? {})) {
            const propName = key as PropertyKey;
            if (instance.editableProperties[propName]) {
              instance.editableProperties[propName].value = val;
            } else {
              warnings.push(`Unknown property "${key}" on widget "${raw.widgetName}" — ignored`);
            }
          }

          // Rebuild runtime-only rule fields stripped from the export
          if (raw.rules?.length) instance.rules = parseSerializedRules(raw.rules);
          return instance;
        };

        const imported = parsed
          .map((raw, idx) => restoreWidget(raw, idx))
          .filter((w): w is Widget => w !== null);

        editModeMacros =
          imported.find((w) => w.id === GRID_ID)?.editableProperties.macros?.value ?? {};

        const s = get();
        set({
          ...commit(imported, { ...s, selectedWidgetIDs: [] }),
          selectedWidgetIDs: [],
          savedContent: serializeWidgets(imported),
          fileLoadedTrig: s.fileLoadedTrig + 1,
          undoStack: [],
          redoStack: [],
        });

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

    importWidgets: (widgetsData) => {
      get().loadWidgets(widgetsData);
      set({ savedContent: null });
    },

    setSavedContent: (savedContent) => set({ savedContent }),

    setPickedWidget: (pickedWidget) => set({ pickedWidget }),
    setIsPlacementMode: (isPlacementMode) => set({ isPlacementMode }),
    setIsDragging: (isDragging) => {
      // called on every drag event
      if (get().isDragging !== isDragging) set({ isDragging });
    },

    handleDragStop: (_e, d, w) => {
      const { setIsDragging, gridSize, snapToGrid, updateWidgetProperties } = get();
      setIsDragging(false);
      if (w.editableProperties.x?.value == d.x && w.editableProperties.y?.value == d.y) return;
      updateWidgetProperties(w.id, {
        x: ensureGridCoordinate(d.x, snapToGrid, gridSize),
        y: ensureGridCoordinate(d.y, snapToGrid, gridSize),
      });
    },

    handleResizeStop: (ref, position, w) => {
      const { setIsDragging, gridSize, snapToGrid, updateWidgetProperties } = get();
      setIsDragging(false);
      const width = ensureGridCoordinate(parseInt(ref.style.width), snapToGrid, gridSize);
      const height = ensureGridCoordinate(parseInt(ref.style.height), snapToGrid, gridSize);
      if (
        w.editableProperties.width?.value === width &&
        w.editableProperties.height?.value === height
      )
        return;
      updateWidgetProperties(w.id, {
        width,
        height,
        x: ensureGridCoordinate(position.x, snapToGrid, gridSize),
        y: ensureGridCoordinate(position.y, snapToGrid, gridSize),
      });
    },

    handleSelGroupDragStop: (dx, dy) => {
      const { gridSize, snapToGrid, selectedWidgets } = get();
      setTimeout(() => get().setIsDragging(false), DRAG_END_DELAY);
      const updates: MultiWidgetPropertyUpdates = {};
      for (const widget of selectedWidgets) {
        const { x, y } = widget.editableProperties;
        if (!x || !y) continue;
        updates[widget.id] = {
          x: ensureGridCoordinate(x.value + dx, snapToGrid, gridSize),
          y: ensureGridCoordinate(y.value + dy, snapToGrid, gridSize),
        };
      }
      batchWidgetUpdate(updates);
    },

    handleSelGroupResizeStop: (ref, bounds, widgets) => {
      const { setIsDragging, gridSize, snapToGrid } = get();
      setIsDragging(false);
      const scaleX = ref.offsetWidth / bounds.width;
      const scaleY = ref.offsetHeight / bounds.height;
      const snap = (v: number) => ensureGridCoordinate(v, snapToGrid, gridSize);
      const updates: MultiWidgetPropertyUpdates = {};
      for (const w of widgets) {
        const { width, height, x, y } = w.editableProperties;
        updates[w.id] = {
          width: snap(width!.value * scaleX),
          height: snap(height!.value * scaleY),
          x: snap(bounds.x + (x!.value - bounds.x) * scaleX),
          y: snap(bounds.y + (y!.value - bounds.y) * scaleY),
        };
      }
      batchWidgetUpdate(updates);
    },

    snapshotEditModeMacros: () => {
      editModeMacros = get().getWidget(GRID_ID)?.editableProperties.macros?.value ?? {};
    },

    restoreEditModeMacros: () => {
      get().updateWidgetProperties(GRID_ID, { macros: editModeMacros }, false);
    },

    forwardNavigationMacros: (macros) =>
      setMacroOverrides({
        navMacroOverrides: composeForwardNavigationMacros(get().navMacroOverrides, macros),
      }),

    setRuleMacroOverrides: (ruleMacroOverrides) => setMacroOverrides({ ruleMacroOverrides }),

    resetRuntimeMacros: () =>
      setMacroOverrides({ navMacroOverrides: NO_MACROS, ruleMacroOverrides: NO_MACROS }),
  };
});
