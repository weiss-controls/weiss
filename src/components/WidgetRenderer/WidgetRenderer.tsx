// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useEffect, useMemo, useRef, type ReactNode } from "react";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import type {
  Widget,
  MultiWidgetPropertyUpdates,
  DOMRectLike,
  WidgetProperties,
} from "@src/types/widgets";
import { Rnd, type DraggableData, type Position, type RndDragEvent } from "react-rnd";
import { GRID_ID } from "@src/constants/constants";
import "./WidgetRenderer.css";
import { useUIContext } from "@src/context/useUIContext";
import { useWidgetContext } from "@src/context/useWidgetContext";
import { usePVStore } from "@src/services/pvStore";
import {
  hasSelectedDescendant,
  collectGlobalMacroOverrides,
  applyGlobalMacros,
} from "./widgetRenderUtils";
import LiveWidget from "./LiveWidget";

const DRAG_END_DELAY = 80; //ms
interface RendererProps {
  scale: number;
  ensureGridCoordinate: (coord: number) => number;
}

const WidgetRenderer: React.FC<RendererProps> = ({ scale, ensureGridCoordinate }) => {
  const { inEditMode, setIsDragging, isPanning, isTextEditing } = useUIContext();
  const {
    editorWidgets,
    selectedWidgetIDs,
    batchWidgetUpdate,
    selectionBounds,
    updateWidgetProperties,
    selectedWidgets,
    setMacroOverrides,
    macros: contextMacros,
  } = useWidgetContext();

  const prevWidgetsMapRef = useRef<Map<string, Widget>>(new Map());
  const prevRawPropsMapRef = useRef<Map<string, WidgetProperties>>(new Map());
  const prevGlobalMacrosRef = useRef<Record<string, string>>({});
  const prevInEditModeRef = useRef(inEditMode);

  const baseGlobalMacros = useMemo(
    () => editorWidgets.find((w) => w.id === GRID_ID)?.editableProperties.macros?.value ?? {},
    [editorWidgets],
  );

  // Keep effectiveGridMacroOverrides in sync with live PV data via a Zustand
  // subscription.  This runs off the render cycle — WidgetRenderer only
  // re-renders if the computed overrides actually change.
  const prevGlobalMacrosJsonRef = useRef<string>("");
  useEffect(() => {
    if (inEditMode) return;
    const unsubscribe = usePVStore.subscribe((state) => {
      const overrides = collectGlobalMacroOverrides(editorWidgets, state.pvs, baseGlobalMacros);
      const json = JSON.stringify(overrides);
      if (json !== prevGlobalMacrosJsonRef.current) {
        prevGlobalMacrosJsonRef.current = json;
        setMacroOverrides(overrides);
      }
    });
    return unsubscribe;
  }, [editorWidgets, baseGlobalMacros, inEditMode, setMacroOverrides]);

  // globalMacros = design-time macros merged with any rule-driven overrides.
  // We read this from WidgetContext (useWidgetManager.macros) rather than from
  // editorWidgets[GRID_ID].editableProperties.macros.value, because the latter
  // only ever holds design-time values — macroOverrides are merged
  // inside useWidgetManager but never written back into the grid widget property.
  const globalMacros = useMemo(() => contextMacros ?? {}, [contextMacros]);

  // Layout computation: applies grid-macro substitution to all widget props.
  const widgetsForLayout = useMemo(() => {
    const modeChanged = inEditMode !== prevInEditModeRef.current;
    prevInEditModeRef.current = inEditMode;
    const prevWidgetsMap = modeChanged ? new Map<string, Widget>() : prevWidgetsMapRef.current;
    const prevRawPropsMap = modeChanged
      ? new Map<string, WidgetProperties>()
      : prevRawPropsMapRef.current;
    const prevGlobalMacros = modeChanged ? {} : prevGlobalMacrosRef.current;

    const { result, nextWidgetsMap, nextRawPropsMap } = applyGlobalMacros(
      editorWidgets,
      globalMacros,
      inEditMode,
      prevWidgetsMap,
      prevRawPropsMap,
      prevGlobalMacros,
    );
    prevWidgetsMapRef.current = nextWidgetsMap;
    prevRawPropsMapRef.current = nextRawPropsMap;
    prevGlobalMacrosRef.current = globalMacros;
    return result;
  }, [editorWidgets, globalMacros, inEditMode]);

  /** Core widget content renderer, delegates PV data to LiveWidget */
  const renderWidgetContent = (w: Widget): ReactNode => {
    if (inEditMode) {
      // In edit mode, render the component directly (no PV data needed).
      const Comp = WidgetRegistry[w.widgetName]?.component;
      return Comp ? <Comp data={w} /> : null;
    }
    return <LiveWidget w={w} globalMacros={globalMacros} />;
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

  const topLevelWidgets = widgetsForLayout.filter((w) => w.id !== GRID_ID);

  return (
    <>
      {topLevelWidgets.map((w) => renderRecursive(w))}
      {renderSelectionGroup()}
    </>
  );
};

export default React.memo(WidgetRenderer);
