// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import React, { memo, useMemo, useRef, type ReactNode } from "react";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import type { DOMRectLike, Widget } from "@src/types/widgets";
import { Rnd, type DraggableData, type Position, type RndDragEvent } from "react-rnd";
import { GRID_ID } from "@src/constants/constants";
import "./WidgetRenderer.css";
import { useInEditMode, useUIStore } from "@src/stores/uiStore";
import { useWidgetContext } from "@src/context/useWidgetContext";
import { hasSelectedDescendant } from "./widgetRenderUtils";
import LiveWidget from "./LiveWidget";

interface RendererProps {
  scale: number;
}

/** Stable callbacks shared by every rendered widget */
interface WidgetHandlers {
  /** Return false to cancel the drag or resize: alt+drag pans the grid instead */
  onDragStart: (e: RndDragEvent) => false | void;
  onResizeStart: (e: React.MouseEvent | React.TouchEvent) => false | void;
  onDragging: () => void;
  onDragStop: (e: RndDragEvent, d: DraggableData, w: Widget) => void;
  onResizeStop: (ref: HTMLElement, position: Position, w: Widget) => void;
  onSelect: (id: string, toggle: boolean) => void;
  onSelGroupDragStop: (dx: number, dy: number) => void;
  onSelGroupResizeStop: (ref: HTMLElement, bounds: DOMRectLike, widgets: Widget[]) => void;
}

/** Props shared by all widgets of one renderer */
interface SharedProps {
  scale: number;
  gridSize: number;
  snapToGrid: boolean;
  /** Runtime macros; undefined in edit mode */
  globalMacros: Record<string, string> | undefined;
  handlers: WidgetHandlers;
}

interface WidgetItemProps extends SharedProps {
  w: Widget;
  parentX: number;
  parentY: number;
  isChild: boolean;
  isEmbedded: boolean;
  isSelected: boolean;
  groupHasSelectedChild: boolean;
  /** Selection ids, passed only to groups with a selected descendant */
  selectedIDs?: string[];
}

const startsPan = (e: { altKey: boolean }) => e.altKey || useUIStore.getState().isPanning;

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

function getGrids(scale: number, gridSize: number, snapToGrid: boolean) {
  if (!snapToGrid) return { dragGrid: undefined, resizeGrid: undefined };
  // dragGrid does not follow the scale - scale it manually
  const scaled = gridSize * scale;
  return {
    dragGrid: [scaled, scaled] as [number, number],
    resizeGrid: [gridSize, gridSize] as [number, number],
  };
}

/** Widget content: the component itself in edit mode, LiveWidget (PV data) in runtime. */
function renderWidgetContent(w: Widget, globalMacros: Record<string, string> | undefined) {
  if (globalMacros) return <LiveWidget w={w} globalMacros={globalMacros} />;
  const Comp = WidgetRegistry[w.widgetName]?.component;
  return Comp ? <Comp data={w} /> : null;
}

function renderWidgetItems(
  widgets: Widget[],
  selectedIDs: string[],
  shared: SharedProps,
  parentX = 0,
  parentY = 0,
  isChild = false,
  isEmbedded = false,
): ReactNode[] {
  return widgets.map((w) => {
    if (w.id === GRID_ID) return null;
    const isSelected = selectedIDs.includes(w.id);
    // multi-selected widgets are rendered inside the selection group
    if (isSelected && selectedIDs.length > 1) return null;
    const groupHasSelectedChild =
      !!w.children?.length && !isSelected && hasSelectedDescendant(w, selectedIDs);
    return (
      <WidgetItem
        key={w.id}
        {...shared}
        w={w}
        parentX={parentX}
        parentY={parentY}
        isChild={isChild}
        isEmbedded={isEmbedded}
        isSelected={isSelected}
        groupHasSelectedChild={groupHasSelectedChild}
        selectedIDs={groupHasSelectedChild ? selectedIDs : undefined}
      />
    );
  });
}

const WidgetItem = memo(function WidgetItem({
  w,
  parentX,
  parentY,
  isChild,
  isEmbedded,
  isSelected,
  groupHasSelectedChild,
  selectedIDs,
  ...shared
}: WidgetItemProps) {
  const { scale, gridSize, snapToGrid, globalMacros, handlers } = shared;
  const inEditMode = useInEditMode();
  const isTextEditing = useUIStore((s) => s.textEditingId === w.id);

  const x = w.editableProperties.x!.value - parentX;
  const y = w.editableProperties.y!.value - parentY;
  const width = w.editableProperties.width!.value;
  const height = w.editableProperties.height!.value;

  const canDrag = inEditMode && !isChild && !isEmbedded && !isTextEditing;
  const canResize = inEditMode && !isChild;
  const isGroup = !!w.children?.length;
  const childIsEmbedded =
    isEmbedded || w.widgetName === "EmbeddedDisplay" || w.widgetName === "NavigationTabs";
  const { dragGrid, resizeGrid } = getGrids(scale, gridSize, snapToGrid);

  const handleMouseDownCapture = (e: React.MouseEvent) => {
    if (!inEditMode || isTextEditing || useUIStore.getState().isPanning) return;
    if (e.button !== 0 || e.altKey) return;
    handlers.onSelect(w.id, e.ctrlKey);
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
      onMouseDownCapture={handleMouseDownCapture}
      onDragStart={handlers.onDragStart}
      onDrag={handlers.onDragging}
      onDragStop={(e, d) => handlers.onDragStop(e, d, w)}
      onResizeStart={handlers.onResizeStart}
      onResizeStop={(_e, _dir, ref, _delta, pos) => handlers.onResizeStop(ref, pos, w)}
    >
      {renderWidgetContent(w, globalMacros)}
      {w.children &&
        renderWidgetItems(
          w.children,
          selectedIDs ?? [],
          shared,
          w.editableProperties.x!.value,
          w.editableProperties.y!.value,
          true,
          childIsEmbedded,
        )}
    </Rnd>
  );
});

interface SelectionGroupProps extends SharedProps {
  bounds: DOMRectLike;
  widgets: Widget[];
}

/** Multi-selection: the selected widgets moved and resized together inside one Rnd */
const SelectionGroup = memo(function SelectionGroup({
  bounds,
  widgets,
  scale,
  gridSize,
  snapToGrid,
  globalMacros,
  handlers,
}: SelectionGroupProps) {
  const inEditMode = useInEditMode();
  const { dragGrid, resizeGrid } = getGrids(scale, gridSize, snapToGrid);

  const renderRecursive = (w: Widget, parentX: number, parentY: number): ReactNode => {
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
        {renderWidgetContent(w, globalMacros)}
        {w.children?.map((child) =>
          renderRecursive(child, w.editableProperties.x!.value, w.editableProperties.y!.value),
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
      size={{ width: bounds.width, height: bounds.height }}
      position={{ x: bounds.x, y: bounds.y }}
      enableResizing={inEditMode}
      disableDragging={!inEditMode}
      resizeHandleStyles={getResizeHandlesSize(bounds.width, bounds.height)}
      onDragStart={handlers.onDragStart}
      onDrag={handlers.onDragging}
      onDragStop={(_e, d) => handlers.onSelGroupDragStop(d.x - bounds.x, d.y - bounds.y)}
      onResizeStart={handlers.onResizeStart}
      onResizeStop={(_e, _dir, ref) => handlers.onSelGroupResizeStop(ref, bounds, widgets)}
    >
      {widgets.map((w) => renderRecursive(w, bounds.x, bounds.y))}
    </Rnd>
  );
});

const WidgetRenderer: React.FC<RendererProps> = ({ scale }) => {
  const ctx = useWidgetContext();
  const { editorWidgets, selectedWidgetIDs, selectionBounds, selectedWidgets } = ctx;
  const inEditMode = useInEditMode();

  // Latest context for the stable handlers below
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const handlers = useMemo<WidgetHandlers>(
    () => ({
      onDragStart: (e) => {
        if (startsPan(e)) return false;
      },
      onResizeStart: (e) => {
        if (startsPan(e)) return false;
        ctxRef.current.setIsDragging(true);
      },
      onDragging: () => ctxRef.current.setIsDragging(true),
      onDragStop: (e, d, w) => ctxRef.current.handleDragStop(e, d, w),
      onResizeStop: (ref, pos, w) => ctxRef.current.handleResizeStop(ref, pos, w),
      onSelect: (id, toggle) => {
        if (toggle) ctxRef.current.toggleWidgetSelectionImmediate(id);
        else ctxRef.current.selectSingleWidgetImmediate(id);
      },
      onSelGroupDragStop: (dx, dy) => ctxRef.current.handleSelGroupDragStop(dx, dy),
      onSelGroupResizeStop: (ref, bounds, widgets) =>
        ctxRef.current.handleSelGroupResizeStop(ref, bounds, widgets),
    }),
    [],
  );

  const shared: SharedProps = {
    scale,
    gridSize: ctx.gridSize,
    snapToGrid: ctx.snapToGrid,
    globalMacros: inEditMode ? undefined : ctx.globalMacros,
    handlers,
  };

  return (
    <>
      {renderWidgetItems(editorWidgets, selectedWidgetIDs, shared)}
      {selectionBounds && selectedWidgetIDs.length > 1 && (
        <SelectionGroup {...shared} bounds={selectionBounds} widgets={selectedWidgets} />
      )}
    </>
  );
};

export default React.memo(WidgetRenderer);
