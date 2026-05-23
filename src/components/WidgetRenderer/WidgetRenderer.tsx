// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useEffect, useMemo, useRef, type ReactNode } from "react";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import type { Widget, MultiWidgetPropertyUpdates, DOMRectLike } from "@src/types/widgets";
import { Rnd, type DraggableData, type Position, type RndDragEvent } from "react-rnd";
import { GRID_ID } from "@src/constants/constants";
import "./WidgetRenderer.css";
import type { PVData } from "@src/types/epicsWS";
import { useUIContext } from "@src/context/useUIContext";
import { useWidgetContext } from "@src/context/useWidgetContext";
import { useEpicsWSContext } from "@src/context/useEpicsWSContext";
import { buildInternalMacros, substituteInStr, substituteTextProps } from "@src/utils/macros";
import { evaluateRules } from "@src/utils/ruleEngine";
import { flattenWidgetTree } from "@src/context/widgetHelpers";

const DRAG_END_DELAY = 80; //ms

const hasSelectedDescendant = (w: Widget, selectedIDs: string[]): boolean =>
  !!w.children?.some((c) => selectedIDs.includes(c.id) || hasSelectedDescendant(c, selectedIDs));

interface RendererProps {
  scale: number;
  ensureGridCoordinate: (coord: number) => number;
}

const WidgetRenderer: React.FC<RendererProps> = ({ scale, ensureGridCoordinate }) => {
  const { inEditMode, setIsDragging, isPanning, isTextEditing } = useUIContext();
  const { pvState } = useEpicsWSContext();
  const {
    editorWidgets,
    selectedWidgetIDs,
    batchWidgetUpdate,
    selectionBounds,
    updateWidgetProperties,
    selectedWidgets,
    setEffectiveGridMacroOverrides,
  } = useWidgetContext();

  // Refs to track previous pvState entries and previously computed Widget objects.
  const prevPVStateRef = useRef<Record<string, PVData>>({});
  const prevWidgetsMapRef = useRef<Map<string, Widget>>(new Map());
  const prevInEditModeRef = useRef(inEditMode);

  // Compute the merged globalMacros overrides produced by all widgets' rules.
  // Separate from widgetsForRender so a useEffect can write the result back to context
  // (to keep PVMap subscriptions current) without the state write happening inside a useMemo.
  const baseGridMacros = useMemo(
    () => editorWidgets.find((w) => w.id === GRID_ID)?.editableProperties.macros?.value ?? {},
    [editorWidgets],
  );

  const globalMacrosOverrides = useMemo(() => {
    if (inEditMode) return {};
    let merged: Record<string, string> = {};
    for (const w of flattenWidgetTree(editorWidgets)) {
      if (!w.rules?.length) continue;
      const wPvName = w.editableProperties.pvName?.value;
      const wPvData = wPvName ? pvState[wPvName] : undefined;
      const wInternalMacros = buildInternalMacros(
        wPvName ? substituteInStr(wPvName, baseGridMacros) : undefined,
        wPvData,
      );
      const wMacros =
        Object.keys(wInternalMacros).length > 0
          ? { ...baseGridMacros, ...wInternalMacros }
          : baseGridMacros;
      const wRuleEvalMacros = wPvName ? { ...wMacros, "$(pvname)": wPvName } : wMacros;
      const wOverrides = evaluateRules(w.rules, pvState, wRuleEvalMacros);
      if (wOverrides.globalMacros && typeof wOverrides.globalMacros === "object") {
        merged = { ...merged, ...(wOverrides.globalMacros as Record<string, string>) };
      }
    }
    return merged;
  }, [editorWidgets, pvState, inEditMode, baseGridMacros]);

  // Write back globalMacros overrides to context (for PVMap subscriptions).
  // JSON.stringify guard prevents unnecessary state updates and infinite loops.
  const prevGlobalMacrosJsonRef = useRef<string>("");
  useEffect(() => {
    const json = JSON.stringify(globalMacrosOverrides);
    if (json !== prevGlobalMacrosJsonRef.current) {
      prevGlobalMacrosJsonRef.current = json;
      setEffectiveGridMacroOverrides(globalMacrosOverrides);
    }
  }, [globalMacrosOverrides, setEffectiveGridMacroOverrides]);

  const widgetsForRender = useMemo(() => {
    const gridMacros =
      Object.keys(globalMacrosOverrides).length > 0
        ? { ...baseGridMacros, ...globalMacrosOverrides }
        : baseGridMacros;
    const prevPVState = prevPVStateRef.current;
    // On mode switch, discard the cache so every widget is fully recomputed for the new mode.
    // Without this, widgets with no PV would pass the stability check and skip macro substitution
    // (or, going the other way, keep stale substituted text in edit mode).
    const modeChanged = inEditMode !== prevInEditModeRef.current;
    prevInEditModeRef.current = inEditMode;
    const prevWidgetsMap = modeChanged ? new Map<string, Widget>() : prevWidgetsMapRef.current;
    const nextWidgetsMap = new Map<string, Widget>();

    const mergeWidget = (w: Widget): Widget => {
      if (inEditMode) {
        nextWidgetsMap.set(w.id, w);
        return w;
      }

      const pvName = w.editableProperties.pvName?.value;
      const pvNames = w.editableProperties.pvNames?.value;

      // Process children first so we can check child stability for the parent decision.
      const newChildren = w.children?.map(mergeWidget);

      // Check if we have PV updates for self, rules, and children
      const rulePVsStable =
        !w.rules?.length ||
        w.rules.every(
          (r) =>
            r.pvNames.every((pv) => pvState[pv] === prevPVState[pv]) &&
            (typeof r.actions?.pvName !== "string" ||
              !r.actions.pvName ||
              pvState[r.actions.pvName] === prevPVState[r.actions.pvName]),
        );
      const ownPVsStable =
        (!pvName || pvState[pvName] === prevPVState[pvName]) &&
        (!pvNames?.length || pvNames.every((pv) => pvState[pv] === prevPVState[pv])) &&
        rulePVsStable;

      const childrenStable =
        !newChildren || newChildren.every((c, i) => c === prevWidgetsMap.get(w.children![i].id));

      // Check if properties changed
      const prevWidget = prevWidgetsMap.get(w.id);
      const structureStable = prevWidget?.editableProperties === w.editableProperties;

      if (ownPVsStable && childrenStable && structureStable) {
        // Nothing changed
        nextWidgetsMap.set(w.id, prevWidget);
        return prevWidget;
      }

      // Something changed
      // evaluate rules with original pvName data so $(pvvalue) works in action values
      const origPvData = pvName ? pvState[pvName] : undefined;
      const origInternalMacros = buildInternalMacros(
        pvName ? substituteInStr(pvName, gridMacros) : undefined,
        origPvData,
      );
      const origAllMacros =
        Object.keys(origInternalMacros).length > 0
          ? { ...gridMacros, ...origInternalMacros }
          : gridMacros;
      const ruleEvalMacros = pvName ? { ...origAllMacros, "$(pvname)": pvName } : origAllMacros;
      const ruleOverrides = evaluateRules(w.rules ?? [], pvState, ruleEvalMacros);

      // derive effective pvName from rule override (if any)
      const effectivePvName =
        typeof ruleOverrides.pvName === "string" && ruleOverrides.pvName
          ? ruleOverrides.pvName
          : pvName;

      // look up pvData using the effective pvName
      let pvData: PVData | undefined;
      let multiPvData: Record<string, PVData> | undefined;

      if (effectivePvName) {
        pvData = pvState[effectivePvName];
      }
      if (pvNames?.length) {
        multiPvData = {};
        for (const pv of pvNames) {
          const d = pvState[pv];
          if (d) multiPvData[substituteInStr(pv, gridMacros)] = d;
        }
      }

      // rebuild internal macros from effective pvName + effective pvData
      const merged: Widget = { ...w, pvData, multiPvData, children: newChildren };
      const internalMacros = buildInternalMacros(
        effectivePvName ? substituteInStr(effectivePvName, gridMacros) : undefined,
        pvData,
      );
      const allMacros =
        Object.keys(internalMacros).length > 0 ? { ...gridMacros, ...internalMacros } : gridMacros;
      const mergedWithMacros: Widget = {
        ...merged,
        editableProperties: substituteTextProps(merged.editableProperties, allMacros),
      };

      //  apply all ruleOverrides to editableProperties.
      // - globalMacros: consumed by the pre-loop, not applied per-widget.
      // - macros: merge delta into existing value rather than replacing wholesale.
      // - all others: plain value replacement.
      const perWidgetOverrides = Object.fromEntries(
        Object.entries(ruleOverrides).filter(([k]) => k !== "globalMacros"),
      );
      const hasOverrides = Object.keys(perWidgetOverrides).length > 0;
      const withRules: Widget = hasOverrides
        ? {
            ...mergedWithMacros,
            editableProperties: Object.fromEntries(
              Object.entries(mergedWithMacros.editableProperties).map(([key, prop]) => {
                const override = perWidgetOverrides[key as keyof typeof perWidgetOverrides];
                if (override === undefined) return [key, prop];
                if (key === "macros" && typeof override === "object" && !Array.isArray(override)) {
                  // Merge delta into existing macro map
                  return [
                    key,
                    {
                      ...prop,
                      value: {
                        ...(prop.value as Record<string, string>),
                        ...override,
                      },
                    },
                  ];
                }
                return [key, { ...prop, value: override }];
              }),
            ) as typeof mergedWithMacros.editableProperties,
          }
        : mergedWithMacros;

      nextWidgetsMap.set(w.id, withRules);
      return withRules;
    };

    const result = editorWidgets.map(mergeWidget);

    // Update refs for the next call
    prevPVStateRef.current = pvState;
    prevWidgetsMapRef.current = nextWidgetsMap;

    return result;
  }, [editorWidgets, pvState, inEditMode, globalMacrosOverrides, baseGridMacros]);

  /** Core widget content renderer */
  const renderWidgetContent = (w: Widget): ReactNode => {
    const Comp = WidgetRegistry[w.widgetName]?.component;
    return Comp ? <Comp data={w} /> : null;
  };

  const handleDragStop = (_e: RndDragEvent, d: DraggableData, w: Widget) => {
    setIsDragging(false);
    if (w.editableProperties.x?.value == d.x && w.editableProperties.y?.value == d.y) return;
    updateWidgetProperties(w.id, {
      x: ensureGridCoordinate(d.x),
      y: ensureGridCoordinate(d.y),
    });
  };

  const handleResizeStop = (ref: HTMLElement, position: Position, w: Widget) => {
    setIsDragging(false);
    const newWidth = ensureGridCoordinate(parseInt(ref.style.width));
    const newHeight = ensureGridCoordinate(parseInt(ref.style.height));
    const newX = ensureGridCoordinate(position.x);
    const newY = ensureGridCoordinate(position.y);

    if (
      w.editableProperties.width?.value === newWidth &&
      w.editableProperties.height?.value === newHeight
    )
      return;

    updateWidgetProperties(w.id, { width: newWidth, height: newHeight, x: newX, y: newY });
  };

  const handleSelGroupResizeStop = (ref: HTMLElement, bounds: DOMRectLike, widgets: Widget[]) => {
    setIsDragging(false);
    const newGroupWidth = ref.offsetWidth;
    const newGroupHeight = ref.offsetHeight;
    const scaleX = newGroupWidth / bounds.width;
    const scaleY = newGroupHeight / bounds.height;

    const updates: MultiWidgetPropertyUpdates = {};
    widgets.forEach((w) => {
      const { width, height, x, y } = {
        width: w.editableProperties.width!.value,
        height: w.editableProperties.height!.value,
        x: w.editableProperties.x!.value,
        y: w.editableProperties.y!.value,
      };
      const relativeX = x - bounds.x;
      const relativeY = y - bounds.y;
      updates[w.id] = {
        width: ensureGridCoordinate(width * scaleX),
        height: ensureGridCoordinate(height * scaleY),
        x: ensureGridCoordinate(bounds.x + relativeX * scaleX),
        y: ensureGridCoordinate(bounds.y + relativeY * scaleY),
      };
    });
    batchWidgetUpdate(updates);
  };

  const handleSelGroupDragStop = (dx: number, dy: number) => {
    setTimeout(() => setIsDragging(false), DRAG_END_DELAY);
    const updates: MultiWidgetPropertyUpdates = {};
    selectedWidgets.forEach((widget) => {
      const xProp = widget.editableProperties.x;
      const yProp = widget.editableProperties.y;
      if (!xProp || !yProp) return;
      updates[widget.id] = {
        x: ensureGridCoordinate(xProp.value + dx),
        y: ensureGridCoordinate(yProp.value + dy),
      };
    });
    batchWidgetUpdate(updates);
  };

  const renderRecursive = (
    w: Widget,
    parentX = 0,
    parentY = 0,
    isChild = false,
    isEmbedded = false,
  ): ReactNode => {
    if (w.id === GRID_ID) return null;
    const isSelected = selectedWidgetIDs.includes(w.id);
    if (isSelected && selectedWidgetIDs.length > 1) return null;

    const x = w.editableProperties.x!.value - parentX;
    const y = w.editableProperties.y!.value - parentY;
    const width = w.editableProperties.width!.value;
    const height = w.editableProperties.height!.value;

    const canDrag = inEditMode && !isPanning && !isChild && !isEmbedded && !isTextEditing;
    const canResize =
      inEditMode && !isPanning && !isChild && !isEmbedded && w.widgetName !== "EmbeddedDisplay";
    const isGroup = w.children?.length;
    const childIsEmbedded = isEmbedded || w.widgetName === "EmbeddedDisplay";
    const groupHasSelectedChild =
      isGroup && !isSelected && hasSelectedDescendant(w, selectedWidgetIDs);

    let editModeClass = "";
    if (inEditMode && !isEmbedded) {
      if (isSelected) editModeClass = "selectable selected";
      else if (groupHasSelectedChild) editModeClass = "selectable groupMemberSelected";
      else if (isGroup) editModeClass = "selectable groupBox";
      else editModeClass = "selectable";
    }

    return (
      <Rnd
        key={w.id}
        id={w.id}
        bounds="window"
        scale={scale}
        disableDragging={!canDrag}
        enableResizing={canResize}
        size={{ width, height }}
        position={{ x, y }}
        className={editModeClass}
        style={isEmbedded && inEditMode ? { pointerEvents: "none" } : undefined}
        onDrag={() => setIsDragging(true)}
        onDragStop={(e, d) => handleDragStop(e, d, w)}
        onResizeStart={() => setIsDragging(true)}
        onResizeStop={(_e, _dir, ref, _delta, pos) => handleResizeStop(ref, pos, w)}
      >
        {renderWidgetContent(w)}
        {w.children?.map((child) =>
          renderRecursive(
            child,
            w.editableProperties.x!.value,
            w.editableProperties.y!.value,
            true,
            childIsEmbedded,
          ),
        )}
      </Rnd>
    );
  };

  /** Render selection group for multi-select */
  const renderSelectionGroup = () => {
    if (!selectionBounds || selectedWidgetIDs.length <= 1) return null;

    const selectedWidgets = editorWidgets.filter((w) => selectedWidgetIDs.includes(w.id));
    const canDrag = inEditMode && !isPanning;
    const canResize = inEditMode && !isPanning;

    const renderRecursiveForSelection = (w: Widget, parentX = 0, parentY = 0): ReactNode => {
      const x = w.editableProperties.x!.value - parentX;
      const y = w.editableProperties.y!.value - parentY;
      const width = w.editableProperties.width!.value;
      const height = w.editableProperties.height!.value;
      const isGroup = w.children?.length;

      return (
        <div
          key={w.id}
          id={w.id}
          className={`selectable selected ${isGroup ? "groupBox" : ""}`}
          style={{ position: "absolute", left: x, top: y, width, height }}
        >
          {renderWidgetContent(w)}
          {w.children?.map((child) =>
            renderRecursiveForSelection(
              child,
              w.editableProperties.x!.value,
              w.editableProperties.y!.value,
            ),
          )}
        </div>
      );
    };

    return (
      <Rnd
        bounds="window"
        className="selectionGroup selectable"
        id="selectionGroup"
        scale={scale}
        size={{ width: selectionBounds.width, height: selectionBounds.height }}
        position={{ x: selectionBounds.x, y: selectionBounds.y }}
        enableResizing={canResize}
        disableDragging={!canDrag}
        onDrag={() => setIsDragging(true)}
        onDragStop={(_e, d) => {
          const dx = d.x - selectionBounds.x;
          const dy = d.y - selectionBounds.y;
          handleSelGroupDragStop(dx, dy);
        }}
        onResizeStart={() => setIsDragging(true)}
        onResizeStop={(_e, _dir, ref, _delta) => {
          handleSelGroupResizeStop(ref, selectionBounds, selectedWidgets);
        }}
      >
        {selectedWidgets.map((w) =>
          renderRecursiveForSelection(w, selectionBounds.x, selectionBounds.y),
        )}
      </Rnd>
    );
  };

  const topLevelWidgets = widgetsForRender.filter((w) => w.id !== GRID_ID);

  return (
    <>
      {topLevelWidgets.map((w) => renderRecursive(w))}
      {renderSelectionGroup()}
    </>
  );
};

export default React.memo(WidgetRenderer);
