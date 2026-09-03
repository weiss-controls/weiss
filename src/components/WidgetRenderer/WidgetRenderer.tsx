// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { type ReactNode } from "react";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import type { Widget } from "@src/types/widgets";
import { Rnd } from "react-rnd";
import { GRID_ID } from "@src/constants/constants";
import "./WidgetRenderer.css";
import { useUIContext } from "@src/context/useUIContext";
import { useWidgetContext } from "@src/context/useWidgetContext";
import { hasSelectedDescendant } from "./widgetRenderUtils";
import LiveWidget from "./LiveWidget";
interface RendererProps {
  scale: number;
}

const WidgetRenderer: React.FC<RendererProps> = ({ scale }) => {
  const { inEditMode, isPanning, isTextEditing } = useUIContext();
  const {
    editorWidgets,
    selectedWidgetIDs,
    selectionBounds,
    selectedWidgets,
    setIsDragging,
    selectSingleWidgetImmediate,
    toggleWidgetSelectionImmediate,
    gridSize,
    snapToGrid,
    globalMacros,
    handleDragStop,
    handleResizeStop,
    handleSelGroupDragStop,
    handleSelGroupResizeStop,
  } = useWidgetContext();

  const resizeGrid = snapToGrid ? ([gridSize, gridSize] as [number, number]) : undefined;
  // dragGrid does not follow the scale - scale it manually
  const scaledGridSize = gridSize * scale;
  const dragGrid = snapToGrid ? ([scaledGridSize, scaledGridSize] as [number, number]) : undefined;

  /** Core widget content renderer, delegates PV data to LiveWidget */
  const renderWidgetContent = (w: Widget): ReactNode => {
    if (inEditMode) {
      // In edit mode, render the component directly (no PV data needed).
      const Comp = WidgetRegistry[w.widgetName]?.component;
      return Comp ? <Comp data={w} /> : null;
    }
    return <LiveWidget w={w} globalMacros={globalMacros} />;
  };

  const getResizeHandlesSize = (width: number, height: number) => {
    // Resize handle size is 10% of the widget size, but clamped between 6px and 24px.
    const handleWidth = Math.min(Math.max(width * 0.1, 6), 24);
    const handleHeight = Math.min(Math.max(height * 0.1, 6), 24);

    return {
      left: { width: `${handleWidth}px` },
      right: { width: `${handleWidth}px` },
      top: { height: `${handleHeight}px` },
      bottom: { height: `${handleHeight}px` },
      topLeft: { width: `${2 * handleWidth}px`, height: `${2 * handleHeight}px` },
      topRight: { width: `${2 * handleWidth}px`, height: `${2 * handleHeight}px` },
      bottomLeft: { width: `${2 * handleWidth}px`, height: `${2 * handleHeight}px` },
      bottomRight: { width: `${2 * handleWidth}px`, height: `${2 * handleHeight}px` },
    };
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
    const canResize = inEditMode && !isPanning && !isChild;
    const isGroup = w.children?.length;
    const childIsEmbedded =
      isEmbedded || w.widgetName === "EmbeddedDisplay" || w.widgetName === "NavigationTabs";
    const groupHasSelectedChild =
      isGroup && !isSelected && hasSelectedDescendant(w, selectedWidgetIDs);

    const handleWidgetMouseDownCapture = (e: React.MouseEvent) => {
      if (!inEditMode || isPanning || isTextEditing) return;
      if (e.button !== 0 || e.altKey) return;
      if (e.ctrlKey) {
        toggleWidgetSelectionImmediate(w.id);
        return;
      }
      selectSingleWidgetImmediate(w.id);
    };

    let editModeClass = "";
    if (inEditMode) {
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
        dragGrid={dragGrid}
        resizeGrid={resizeGrid}
        disableDragging={!canDrag}
        enableResizing={canResize}
        resizeHandleStyles={getResizeHandlesSize(width, height)}
        size={{ width, height }}
        position={{ x, y }}
        className={editModeClass}
        style={isEmbedded && inEditMode ? { pointerEvents: "none" } : undefined}
        onMouseDownCapture={handleWidgetMouseDownCapture}
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
    const selectionWidth = selectionBounds.width;
    const selectionHeight = selectionBounds.height;
    const selectionX = selectionBounds.x;
    const selectionY = selectionBounds.y;

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
        dragGrid={dragGrid}
        resizeGrid={resizeGrid}
        size={{ width: selectionWidth, height: selectionHeight }}
        position={{ x: selectionX, y: selectionY }}
        enableResizing={canResize}
        disableDragging={!canDrag}
        resizeHandleStyles={getResizeHandlesSize(selectionWidth, selectionHeight)}
        onDrag={() => setIsDragging(true)}
        onDragStop={(_e, d) => {
          const dx = d.x - selectionX;
          const dy = d.y - selectionY;
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

  const topLevelWidgets = editorWidgets.filter((w) => w.id !== GRID_ID);

  return (
    <>
      {topLevelWidgets.map((w) => renderRecursive(w))}
      {renderSelectionGroup()}
    </>
  );
};

export default React.memo(WidgetRenderer);
