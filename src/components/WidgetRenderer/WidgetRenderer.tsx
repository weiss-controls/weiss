// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useMemo, type ReactNode } from "react";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import type { Widget, MultiWidgetPropertyUpdates, DOMRectLike } from "@src/types/widgets";
import { Rnd, type DraggableData, type Position, type RndDragEvent } from "react-rnd";
import { GRID_ID } from "@src/constants/constants";
import "./WidgetRenderer.css";
import type { PVData } from "@src/types/epicsWS";
import { useUIContext } from "@src/context/useUIContext";
import { useWidgetContext } from "@src/context/useWidgetContext";
import { useEpicsWSContext } from "@src/context/useEpicsWSContext";

const DRAG_END_DELAY = 80; //ms

interface RendererProps {
  scale: number;
  ensureGridCoordinate: (coord: number) => number;
}

const WidgetRenderer: React.FC<RendererProps> = ({ scale, ensureGridCoordinate }) => {
  const { inEditMode, setIsDragging, isPanning } = useUIContext();
  const { pvState } = useEpicsWSContext();
  const {
    editorWidgets,
    selectedWidgetIDs,
    batchWidgetUpdate,
    selectionBounds,
    updateWidgetProperties,
    selectedWidgets,
  } = useWidgetContext();

  const widgetsForRender = useMemo(() => {
    const mergeWidget = (w: Widget): Widget => {
      if (inEditMode) return w;
      let pvData: PVData | undefined = undefined;
      let multiPvData: Record<string, PVData> | undefined = undefined;

      if (w.editableProperties.pvName?.value) {
        pvData = pvState[w.editableProperties.pvName.value];
      }
      if (w.editableProperties.pvNames?.value) {
        multiPvData = {};
        Object.values(w.editableProperties.pvNames.value).forEach((pv) => {
          const data = pvState[pv];
          if (data) multiPvData![pv] = data;
        });
      }

      return {
        ...w,
        pvData,
        multiPvData,
        children: w.children?.map(mergeWidget),
      };
    };

    return editorWidgets.map(mergeWidget);
  }, [editorWidgets, pvState, inEditMode]);

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

    const canDrag = inEditMode && !isPanning && !isChild && !isEmbedded;
    const canResize =
      inEditMode && !isPanning && !isChild && !isEmbedded && w.widgetName !== "EmbeddedDisplay";
    const isGroup = w.children?.length;
    const childIsEmbedded = isEmbedded || w.widgetName === "EmbeddedDisplay";

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
        className={
          inEditMode && !isEmbedded
            ? `selectable ${isSelected ? "selected" : isGroup ? "groupBox" : ""}`
            : ""
        }
        style={isEmbedded ? { pointerEvents: "none" } : undefined}
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

export default WidgetRenderer;
