// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { FRONT_UI_ZIDX, GRID_ID } from "@src/constants/constants";
import { useWidgetContext } from "@src/context/useWidgetContext";
import React, { useRef, useState, useEffect } from "react";

interface SelectionManagerProps {
  gridRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  pan: { x: number; y: number };
  enabled?: boolean;
  guidesVisible?: boolean;
}

const CLICK_THRESHOLD = 3;

const SelectionManager: React.FC<SelectionManagerProps> = ({
  gridRef,
  zoom,
  pan,
  guidesVisible,
}) => {
  const { editorWidgets, setSelectedWidgetIDs, selectedWidgetIDs, isDragging, selectionBounds } =
    useWidgetContext();
  const [selectionArea, setSelectionArea] = useState<{
    start?: { x: number; y: number };
    end?: { x: number; y: number };
  }>({});
  const isSelecting = !!selectionArea.start;

  const areaRef = useRef<HTMLDivElement>(null);
  const downTargetRef = useRef<EventTarget | null>(null);
  const [dragGuideBounds, setDragGuideBounds] = useState<{
    left: number;
    right: number;
    top: number;
    bottom: number;
  } | null>(null);

  useEffect(() => {
    if (!guidesVisible || !isDragging) {
      setDragGuideBounds(null);
      return;
    }

    const updateGuidesFromDragTarget = () => {
      const grid = gridRef.current;
      if (!grid) return;

      const dragTarget =
        document.getElementById("selectionGroup") ??
        (selectedWidgetIDs.length === 1 ? document.getElementById(selectedWidgetIDs[0]) : null);
      if (!dragTarget) return;

      const gridRect = grid.getBoundingClientRect();
      const selRect = dragTarget.getBoundingClientRect();

      const next = {
        left: selRect.left - gridRect.left,
        right: selRect.right - gridRect.left,
        top: selRect.top - gridRect.top,
        bottom: selRect.bottom - gridRect.top,
      };

      setDragGuideBounds((prev) => {
        if (
          prev &&
          prev.left === next.left &&
          prev.right === next.right &&
          prev.top === next.top &&
          prev.bottom === next.bottom
        ) {
          return prev;
        }
        return next;
      });
    };

    updateGuidesFromDragTarget();

    let active = true;
    let rafId = 0;
    const tick = () => {
      if (!active) return;
      updateGuidesFromDragTarget();
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    return () => {
      active = false;
      window.cancelAnimationFrame(rafId);
    };
  }, [gridRef, guidesVisible, isDragging, selectedWidgetIDs]);

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
      if (id === "selectionGroup") {
        setSelectionArea({});
        return;
      }
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
        if (id === GRID_ID) {
          setSelectedWidgetIDs([]);
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

  const hasSelectionArea = isSelecting && !!selectionArea.end;
  const showDragGuides = Boolean(guidesVisible && isDragging && selectionBounds);

  if (!hasSelectionArea && !showDragGuides) return null;

  const x = hasSelectionArea
    ? Math.min(selectionArea.start!.x, selectionArea.end!.x) * zoom + pan.x
    : 0;
  const y = hasSelectionArea
    ? Math.min(selectionArea.start!.y, selectionArea.end!.y) * zoom + pan.y
    : 0;
  const w = hasSelectionArea ? Math.abs(selectionArea.end!.x - selectionArea.start!.x) * zoom : 0;
  const h = hasSelectionArea ? Math.abs(selectionArea.end!.y - selectionArea.start!.y) * zoom : 0;

  const guideLeft = showDragGuides
    ? (dragGuideBounds?.left ?? selectionBounds!.x * zoom + pan.x)
    : 0;
  const guideRight = showDragGuides
    ? (dragGuideBounds?.right ?? (selectionBounds!.x + selectionBounds!.width) * zoom + pan.x)
    : 0;
  const guideTop = showDragGuides ? (dragGuideBounds?.top ?? selectionBounds!.y * zoom + pan.y) : 0;
  const guideBottom = showDragGuides
    ? (dragGuideBounds?.bottom ?? (selectionBounds!.y + selectionBounds!.height) * zoom + pan.y)
    : 0;

  return (
    <>
      {showDragGuides && (
        <>
          <div
            style={{
              position: "absolute",
              left: guideLeft,
              top: 0,
              width: 0,
              height: "100%",
              borderLeft: "1px dashed rgba(0, 128, 255, 0.8)",
              pointerEvents: "none",
              zIndex: FRONT_UI_ZIDX - 1,
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: guideRight,
              top: 0,
              width: 0,
              height: "100%",
              borderLeft: "1px dashed rgba(0, 128, 255, 0.8)",
              pointerEvents: "none",
              zIndex: FRONT_UI_ZIDX - 1,
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: guideTop,
              width: "100%",
              height: 0,
              borderTop: "1px dashed rgba(0, 128, 255, 0.8)",
              pointerEvents: "none",
              zIndex: FRONT_UI_ZIDX - 1,
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: guideBottom,
              width: "100%",
              height: 0,
              borderTop: "1px dashed rgba(0, 128, 255, 0.8)",
              pointerEvents: "none",
              zIndex: FRONT_UI_ZIDX - 1,
              boxSizing: "border-box",
            }}
          />
        </>
      )}
      {hasSelectionArea && (
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
      )}
    </>
  );
};

export default SelectionManager;
