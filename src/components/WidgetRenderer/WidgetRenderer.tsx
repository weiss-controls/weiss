// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import React, { memo, useLayoutEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import type { Widget } from "@src/types/widgets";
import { Rnd, type RndDragEvent } from "react-rnd";
import "./WidgetRenderer.css";
import { useUIStore } from "@src/stores/uiStore";
import { useEditorStore } from "@src/stores/editorStore";
import { hasSelectedDescendant } from "./widgetRenderUtils";
import LiveWidget from "./LiveWidget";

interface RendererProps {
  scale: number;
}

interface WidgetItemProps {
  id: string;
  scale: number;
  parentX?: number;
  parentY?: number;
  isChild?: boolean;
  isEmbedded?: boolean;
}

// Rnd start handlers return false to cancel: alt+drag pans the grid instead
function handleDragStart(e: RndDragEvent) {
  if (e.altKey || useUIStore.getState().isPanning) return false;
}
function handleResizeStart(e: React.MouseEvent | React.TouchEvent) {
  if (e.altKey || useUIStore.getState().isPanning) return false;
  useEditorStore.getState().setIsDragging(true);
}
function handleDragging() {
  useEditorStore.getState().setIsDragging(true);
}

/** Resize handle size is 10% of the widget size, clamped between 6px and 24px. */
function getResizeHandlesSize(width: number, height: number) {
  const handleWidth = Math.min(Math.max(width * 0.1, 6), 24);
  const handleHeight = Math.min(Math.max(height * 0.1, 6), 24);
  const corner = { width: `${2 * handleWidth}px`, height: `${2 * handleHeight}px` };
  return {
    left: { width: `${handleWidth}px` },
    right: { width: `${handleWidth}px` },
    top: { height: `${handleHeight}px` },
    bottom: { height: `${handleHeight}px` },
    topLeft: corner,
    topRight: corner,
    bottomLeft: corner,
    bottomRight: corner,
  };
}

/** Rnd snapping grids; the drag grid does not follow the scale, so it is scaled here */
function useGrids(scale: number) {
  const gridSize = useEditorStore((s) => s.gridSize);
  const snapToGrid = useEditorStore((s) => s.snapToGrid);
  if (!snapToGrid) return { dragGrid: undefined, resizeGrid: undefined };
  const scaled = gridSize * scale;
  return {
    dragGrid: [scaled, scaled] as [number, number],
    resizeGrid: [gridSize, gridSize] as [number, number],
  };
}

/**
 * Widget content and children: the component itself in edit mode, LiveWidget (PV data and rules)
 * in runtime. Nothing is rendered for a hidden widget (`visible` false).
 */
function renderWidgetContent(
  w: Widget,
  globalMacros: Record<string, string> | undefined,
  children: React.ReactNode,
) {
  if (globalMacros) {
    return (
      <LiveWidget w={w} globalMacros={globalMacros}>
        {children}
      </LiveWidget>
    );
  }
  if (w.editableProperties.visible?.value === false) return null;
  const Comp = WidgetRegistry[w.widgetName]?.component;
  return (
    <>
      {Comp && <Comp data={w} />}
      {children}
    </>
  );
}

// Children render through the memoized `WidgetItem`. In a named function expression passed to
// memo(), the function's own name would refer to the unmemoized function.
const WidgetItem = memo(WidgetItemBase);

function WidgetItemBase({
  id,
  scale,
  parentX = 0,
  parentY = 0,
  isChild = false,
  isEmbedded = false,
}: WidgetItemProps) {
  const w = useEditorStore((s) => s.widgetIdMap.get(id));
  const isSelected = useEditorStore((s) => s.selectedWidgetIDs.includes(id));
  // multi-selected widgets are moved and resized by the selection group overlay
  const inSelectionGroup = useEditorStore(
    (s) => s.selectedWidgetIDs.length > 1 && s.selectedWidgetIDs.includes(id),
  );
  const groupHasSelectedChild = useEditorStore((s) => {
    const group = s.widgetIdMap.get(id);
    return (
      !!group?.children?.length &&
      !s.selectedWidgetIDs.includes(id) &&
      hasSelectedDescendant(group, s.selectedWidgetIDs)
    );
  });
  const inEditMode = useUIStore((s) => s.inEditMode);
  const isTextEditing = useUIStore((s) => s.textEditingId === id);
  const globalMacros = useEditorStore((s) => (inEditMode ? undefined : s.globalMacros));
  const { dragGrid, resizeGrid } = useGrids(scale);

  if (!w) return null;

  const x = w.editableProperties.x!.value - parentX;
  const y = w.editableProperties.y!.value - parentY;
  const width = w.editableProperties.width!.value;
  const height = w.editableProperties.height!.value;

  const canDrag = inEditMode && !isChild && !isEmbedded && !isTextEditing && !inSelectionGroup;
  const canResize = inEditMode && !isChild && !inSelectionGroup;
  const isGroup = !!w.children?.length;
  const childIsEmbedded =
    isEmbedded || w.widgetName === "EmbeddedDisplay" || w.widgetName === "NavigationTabs";

  const handleMouseDownCapture = (e: React.MouseEvent) => {
    if (!inEditMode || isTextEditing || useUIStore.getState().isPanning) return;
    if (e.button !== 0 || e.altKey) return;
    const { toggleWidgetSelectionImmediate, selectSingleWidgetImmediate } =
      useEditorStore.getState();
    if (e.ctrlKey) toggleWidgetSelectionImmediate(id);
    else selectSingleWidgetImmediate(id);
  };

  let widgetClass = "runtimeWidget";
  if (inEditMode) {
    if (isSelected) widgetClass = "selectable selected";
    else if (groupHasSelectedChild) widgetClass = "selectable groupMemberSelected";
    else if (isGroup) widgetClass = "selectable groupBox";
    else widgetClass = "selectable";
  }

  return (
    <Rnd
      id={id}
      bounds="window"
      scale={scale}
      dragGrid={dragGrid}
      resizeGrid={resizeGrid}
      disableDragging={!canDrag}
      enableResizing={canResize}
      resizeHandleStyles={getResizeHandlesSize(width, height)}
      size={{ width, height }}
      position={{ x, y }}
      className={widgetClass}
      style={isEmbedded && inEditMode ? { pointerEvents: "none" } : undefined}
      onMouseDownCapture={handleMouseDownCapture}
      onDragStart={handleDragStart}
      onDrag={handleDragging}
      onDragStop={(e, d) => useEditorStore.getState().handleDragStop(e, d, w)}
      onResizeStart={handleResizeStart}
      onResizeStop={(_e, _dir, ref, _delta, pos) =>
        useEditorStore.getState().handleResizeStop(ref, pos, w)
      }
    >
      {renderWidgetContent(
        w,
        globalMacros,
        w.children?.map((child) => (
          <WidgetItem
            key={child.id}
            id={child.id}
            scale={scale}
            parentX={w.editableProperties.x!.value}
            parentY={w.editableProperties.y!.value}
            isChild
            isEmbedded={childIsEmbedded}
          />
        )),
      )}
    </Rnd>
  );
}

/** Offsets the selected widgets with CSS `translate`, which composes with the Rnd transform */
function translateWidgets(ids: string[], dx: number, dy: number) {
  const value = dx || dy ? `${dx}px ${dy}px` : "";
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.style.translate = value;
  }
}

/**
 * Multi-selection: an empty Rnd over the selection bounds. The selected widgets keep their place
 * in the render order (and z-order); while dragging they follow the overlay through `translate`.
 * The offset is state applied in a layout effect, which commits it in the same render as the
 * react-draggable position of the overlay.
 */
const SelectionGroup = memo(function SelectionGroup({ scale }: RendererProps) {
  const bounds = useEditorStore((s) => (s.selectedWidgetIDs.length > 1 ? s.selectionBounds : null));
  const widgets = useEditorStore(useShallow((s) => s.selectedWidgets));
  const inEditMode = useUIStore((s) => s.inEditMode);
  const { dragGrid, resizeGrid } = useGrids(scale);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const ids = widgets.map((w) => w.id);
    translateWidgets(ids, dragOffset.x, dragOffset.y);
    return () => translateWidgets(ids, 0, 0);
  }, [widgets, dragOffset]);

  if (!bounds) return null;

  return (
    <Rnd
      bounds="window"
      className="selectionGroup selectable"
      id="selectionGroup"
      scale={scale}
      dragGrid={dragGrid}
      resizeGrid={resizeGrid}
      size={{ width: bounds.width, height: bounds.height }}
      position={{ x: bounds.x, y: bounds.y }}
      enableResizing={inEditMode}
      disableDragging={!inEditMode}
      resizeHandleStyles={getResizeHandlesSize(bounds.width, bounds.height)}
      onDragStart={handleDragStart}
      onDrag={(_e, d) => {
        handleDragging();
        setDragOffset({ x: d.x - bounds.x, y: d.y - bounds.y });
      }}
      onDragStop={(_e, d) => {
        setDragOffset({ x: 0, y: 0 });
        useEditorStore.getState().handleSelGroupDragStop(d.x - bounds.x, d.y - bounds.y);
      }}
      onResizeStart={handleResizeStart}
      onResizeStop={(_e, _dir, ref) =>
        useEditorStore.getState().handleSelGroupResizeStop(ref, bounds, widgets)
      }
    />
  );
});

const WidgetRenderer: React.FC<RendererProps> = ({ scale }) => {
  const ids = useEditorStore(useShallow((s) => s.allWidgetIDs));
  return (
    <>
      {ids.map((id) => (
        <WidgetItem key={id} id={id} scale={scale} />
      ))}
      <SelectionGroup scale={scale} />
    </>
  );
};

export default React.memo(WidgetRenderer);
