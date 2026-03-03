// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { FRONT_UI_ZIDX, GRID_ID } from "@src/constants/constants";
import { useUIContext } from "@src/context/useUIContext";
import { useWidgetContext } from "@src/context/useWidgetContext";
import React, { useRef, useState, useEffect } from "react";

interface SelectionManagerProps {
  gridRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  pan: { x: number; y: number };
  enabled?: boolean;
}

const CLICK_THRESHOLD = 3;

const SelectionManager: React.FC<SelectionManagerProps> = ({ gridRef, zoom, pan }) => {
  const { editorWidgets, setSelectedWidgetIDs, selectedWidgetIDs } = useWidgetContext();
  const { isDragging } = useUIContext();
  const [selectionArea, setSelectionArea] = useState<{
    start?: { x: number; y: number };
    end?: { x: number; y: number };
  }>({});
  const isSelecting = !!selectionArea.start;

  const areaRef = useRef<HTMLDivElement>(null);
  const downTargetRef = useRef<EventTarget | null>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const disableTxtSelection = () => {
      document.body.style.userSelect = "none";
    };

    const enableTxtSelection = () => {
      document.body.style.userSelect = "";
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || e.altKey || isDragging) return;
      const target = e.target as HTMLElement;
      const id = target.getAttribute("id");
      downTargetRef.current = target;
      if (id !== GRID_ID) return;
      disableTxtSelection();
      const rect = grid.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;

      setSelectionArea({ start: { x, y }, end: { x, y } });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!selectionArea.start) return;
      const rect = grid.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      setSelectionArea((prev) => (prev.start ? { ...prev, end: { x, y } } : prev));
    };

    const handleMouseUp = (e: MouseEvent) => {
      enableTxtSelection();
      const target = e.target as HTMLElement;
      const id = target.getAttribute("id");
      const widgetEl = target.closest(".selectable");
      if ((id !== GRID_ID && !widgetEl) || id === "selectionGroup") return;
      // Ignore mouse up if dragging widgets
      if (isDragging) {
        setSelectionArea({});
        return;
      }

      const rect = grid.getBoundingClientRect();
      const xEnd = (e.clientX - rect.left - pan.x) / zoom;
      const yEnd = (e.clientY - rect.top - pan.y) / zoom;

      // No active selection: interpret as click
      if (!selectionArea.start) {
        // ignore if click started elsewhere
        if (target !== downTargetRef.current) return;
        const wId = widgetEl?.getAttribute("id");
        if (!wId) {
          setSelectedWidgetIDs([]);
          return;
        }
        if (e.ctrlKey) {
          setSelectedWidgetIDs((prev) =>
            prev.includes(wId) ? prev.filter((pid) => pid !== wId) : [...prev, wId],
          );
        } else if (!selectedWidgetIDs.includes(wId)) {
          setSelectedWidgetIDs([wId]);
        }
        return;
      }

      // Finish area selection
      const { start } = selectionArea;
      const dx = Math.abs(xEnd - start.x);
      const dy = Math.abs(yEnd - start.y);

      // just a click (too small)
      if (dx < CLICK_THRESHOLD && dy < CLICK_THRESHOLD) {
        setSelectionArea({});
        setSelectedWidgetIDs([]);
        return;
      }

      const selX = Math.min(start.x, xEnd);
      const selY = Math.min(start.y, yEnd);
      const selW = Math.abs(xEnd - start.x);
      const selH = Math.abs(yEnd - start.y);

      const selectedIds = editorWidgets
        .filter((w) => {
          if (w.id === GRID_ID) return false;
          const { x, y, width, height } = {
            x: w.editableProperties.x!.value,
            y: w.editableProperties.y!.value,
            width: w.editableProperties.width!.value,
            height: w.editableProperties.height!.value,
          };
          return x >= selX && y >= selY && x + width <= selX + selW && y + height <= selY + selH;
        })
        .map((w) => w.id);
      setSelectedWidgetIDs(selectedIds);
      setSelectionArea({});
    };

    grid.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      grid.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    zoom,
    pan,
    gridRef,
    editorWidgets,
    setSelectedWidgetIDs,
    selectionArea,
    isDragging,
    selectedWidgetIDs,
  ]);

  if (!isSelecting || !selectionArea.end) return null;
  const x = Math.min(selectionArea.start!.x, selectionArea.end.x) * zoom + pan.x;
  const y = Math.min(selectionArea.start!.y, selectionArea.end.y) * zoom + pan.y;
  const w = Math.abs(selectionArea.end.x - selectionArea.start!.x) * zoom;
  const h = Math.abs(selectionArea.end.y - selectionArea.start!.y) * zoom;

  return (
    <div
      ref={areaRef}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        border: "1px solid rgba(0, 128, 255, 0.8)",
        backgroundColor: "rgba(0, 128, 255, 0.2)",
        pointerEvents: "none",
        zIndex: FRONT_UI_ZIDX - 1,
        boxSizing: "border-box",
      }}
    />
  );
};

export default SelectionManager;
