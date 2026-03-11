// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { GridPosition, WidgetDefinition, WidgetUpdate } from "@src/types/widgets";
import { createWidgetInstance } from "@src/context/widgetHelpers";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import {
  FRONT_UI_ZIDX,
  GRID_ID,
  MAX_ZOOM,
  MIN_ZOOM,
  ROUNDING_CONST,
} from "@src/constants/constants";
import ContextMenu from "@components/ContextMenu/ContextMenu";
import "./GridZone.css";
import WidgetRenderer from "@components/WidgetRenderer/WidgetRenderer.tsx";
import ToolbarButtons from "@components/Toolbar/Toolbar.tsx";
import { v4 as uuidv4 } from "uuid";
import SelectionManager from "./SelectionManager/SelectionManager";
import { Box, CircularProgress } from "@mui/material";
import { useWidgetContext } from "@src/context/useWidgetContext";
import { useUIContext } from "@src/context/useUIContext";

/**
 * GridZoneComp renders the main editor canvas where widgets are displayed, moved, and interacted with.
 *
 * @features
 * - Drag and drop new widgets from the registry.
 * - Panning and zooming of the grid.
 * - Selection of multiple widgets using drag selection (via Selecto).
 * - Calls context menu actions like cut, copy, paste, z-order management.
 * - Monitors keyboard shortcuts.
 *
 * @param data WidgetUpdate object containing editable properties for the grid.
 *
 * @notes
 * - Zooming is constrained by MIN_ZOOM and MAX_ZOOM constants.
 * - Panning centers the grid on first load or when middle mouse button is used.
 */
const GridZoneComp: React.FC<WidgetUpdate> = ({ data }) => {
  const props = data.editableProperties;

  const {
    mode,
    disableGridShortcuts,
    isPanning,
    setIsPanning,
    inEditMode,
    selectedFile,
    isDeveloper,
    isReposLoading,
  } = useUIContext();

  const {
    addWidget,
    selectedWidgetIDs,
    setSelectedWidgetIDs,
    handleRedo,
    handleUndo,
    copyWidget,
    pasteWidget,
    downloadWidgets,
    deleteWidget,
    allWidgetIDs,
    pickedWidget,
    groupSelected,
    ungroupSelected,
    moveSelected,
  } = useWidgetContext();

  const gridRef = useRef<HTMLDivElement>(null);
  const lastPosRef = useRef<GridPosition>({ x: 0, y: 0 });
  const mousePosRef = useRef<GridPosition>({ x: 0, y: 0 });
  const gridGrabbed = useRef(false);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<GridPosition>({ x: 0, y: 0 });
  const [contextMenuPos, setContextMenuPos] = useState<GridPosition>({ x: 0, y: 0 });
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [shouldCenterPan, setShouldCenterPan] = useState(true);
  const [dragPreview, setDragPreview] = useState<{
    widget: WidgetDefinition;
    x: number;
    y: number;
  } | null>(null);
  const gridSize = props.gridSize!.value;
  const snapToGrid = props.snapToGrid?.value;
  const gridLineVisible = props.gridLineVisible?.value;

  const ensureGridCoordinate = useCallback(
    (coord: number) => {
      const aligned = snapToGrid ? Math.round(coord / gridSize) * gridSize : coord;
      return Math.round(aligned * ROUNDING_CONST) / ROUNDING_CONST;
    },
    [snapToGrid, gridSize],
  );

  const centerScreen = () => {
    setZoom(1);
    setShouldCenterPan(true);
  };

  useEffect(() => {
    if (shouldCenterPan && zoom === 1) {
      const container = document.getElementById("gridContainer");

      if (container) {
        const containerBounds = container.getBoundingClientRect();

        const centerX = containerBounds.width / 2;
        const centerY = containerBounds.height / 2;

        setPan({ x: centerX, y: centerY });
        setShouldCenterPan(false);
      }
    }
  }, [shouldCenterPan, zoom, mode]);

  useEffect(() => {
    const handleCtrlZoom = (e: WheelEvent) => {
      // disable standard zoom/pinch
      if (e.ctrlKey) e.preventDefault();
    };
    window.addEventListener("wheel", handleCtrlZoom, { passive: false });
    return () => {
      window.removeEventListener("wheel", handleCtrlZoom);
    };
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!pickedWidget) return setDragPreview(null);
    const rect = e.currentTarget.getBoundingClientRect();
    const userX = (e.clientX - rect.left - pan.x) / zoom;
    const userY = (e.clientY - rect.top - pan.y) / zoom;

    setDragPreview({
      widget: pickedWidget,
      x: ensureGridCoordinate(userX),
      y: ensureGridCoordinate(userY),
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    if (!data) {
      console.warn("No data found in dropped widget");
      return;
    }
    const entry = JSON.parse(data) as { widgetName: string };
    const droppedComp = WidgetRegistry[entry.widgetName];
    if (!droppedComp) {
      console.warn(`Unknown component: ${entry.widgetName}`);
      return;
    }

    // Drop position
    const rect = e.currentTarget.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const userX = (rawX - pan.x) / zoom;
    const userY = (rawY - pan.y) / zoom;

    const newWidget = createWidgetInstance(droppedComp, `${entry.widgetName}-${uuidv4()}`);
    if (newWidget.editableProperties.x)
      newWidget.editableProperties.x.value = ensureGridCoordinate(userX);
    if (newWidget.editableProperties.y)
      newWidget.editableProperties.y.value = ensureGridCoordinate(userY);

    addWidget(newWidget);
    setDragPreview(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const scaleFactor = 1.1;
    const direction = e.deltaY < 0 ? 1 : -1;
    const z = zoom * (direction > 0 ? scaleFactor : 1 / scaleFactor);
    const newZoom = Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM); // keep between limits
    const container = gridRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const contentX = (mouseX - pan.x) / zoom;
    const contentY = (mouseY - pan.y) / zoom;

    const newPanX = mouseX - contentX * newZoom;
    const newPanY = mouseY - contentY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      gridGrabbed.current = true;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 1 && !isPanning) {
      centerScreen();
    }
    gridGrabbed.current = false;
    setIsPanning(false);
  };

  const handleClick = (_e: React.MouseEvent) => {
    setContextMenuVisible(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setContextMenuVisible(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return;
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const userX = (rawX - pan.x) / zoom;
      const userY = (rawY - pan.y) / zoom;

      mousePosRef.current = {
        x: ensureGridCoordinate(userX),
        y: ensureGridCoordinate(userY),
      };
      if (gridGrabbed.current) {
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        // Only consider a pan if there is actual movement
        if (!isPanning && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
          setIsPanning(true);
        }
        lastPosRef.current = { x: e.clientX, y: e.clientY };
        setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [gridGrabbed, isPanning, setIsPanning, ensureGridCoordinate, pan, zoom, mode]);

  // Shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disableGridShortcuts) return;
      // shortcuts for all modes
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        centerScreen();
        return;
      }
      if (!inEditMode) return;
      // shortcuts for edit mode only
      if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        downloadWidgets().catch((err) => {
          console.error("Failed to download widgets:", err);
        });
        return;
      }
      if (e.key.toLowerCase() === "delete" && selectedWidgetIDs.length > 0) {
        e.preventDefault();
        deleteWidget();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (
        (e.ctrlKey && e.key.toLowerCase() === "y") ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copyWidget();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteWidget(mousePosRef.current);
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedWidgetIDs(allWidgetIDs);
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        groupSelected();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        ungroupSelected();
        return;
      }
      if (e.key.toLowerCase() === "arrowleft") {
        e.preventDefault();
        moveSelected(-gridSize, 0);
        return;
      }
      if (e.key.toLowerCase() === "arrowright") {
        e.preventDefault();
        moveSelected(gridSize, 0);
      }
      if (e.key.toLowerCase() === "arrowup") {
        e.preventDefault();
        moveSelected(0, -gridSize);
        return;
      }
      if (e.key.toLowerCase() === "arrowdown") {
        e.preventDefault();
        moveSelected(0, gridSize);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div
      ref={gridRef}
      id={GRID_ID}
      className="gridZone"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      style={{
        cursor: gridGrabbed.current ? "grabbing" : "default",
        backgroundColor: props.backgroundColor?.value,
        backgroundImage:
          gridLineVisible && inEditMode
            ? `linear-gradient(${props.gridLineColor!.value} 1px, transparent 1px),
        linear-gradient(90deg, ${props.gridLineColor!.value} 1px, transparent 1px)`
            : "none",
        backgroundSize: `${props.gridSize!.value * zoom}px ${props.gridSize!.value * zoom}px`,
        backgroundPosition: `${pan.x % (props.gridSize!.value * zoom)}px ${
          pan.y % (props.gridSize!.value * zoom)
        }px`,
      }}
    >
      <div
        id="centerRef"
        className={`centerRef ${inEditMode && props.centerVisible?.value ? "centerMark" : ""}`}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {dragPreview && (
          <div
            style={{
              position: "absolute",
              left: dragPreview.x,
              top: dragPreview.y,
              width: dragPreview.widget.defaultProperties.width?.value ?? 100,
              height: dragPreview.widget.defaultProperties.height?.value ?? 50,
              border: "2px dashed #00aaff",
              pointerEvents: "none",
              zIndex: FRONT_UI_ZIDX,
            }}
          />
        )}
        <WidgetRenderer scale={zoom} ensureGridCoordinate={ensureGridCoordinate} />
      </div>
      {inEditMode && <SelectionManager gridRef={gridRef} zoom={zoom} pan={pan} />}
      <ToolbarButtons />
      <ContextMenu
        pos={contextMenuPos}
        mousePos={mousePosRef.current}
        visible={contextMenuVisible}
        onClose={() => {
          setContextMenuVisible(false);
        }}
      />
      {isReposLoading && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: FRONT_UI_ZIDX,
            pointerEvents: "none",
          }}
        >
          <CircularProgress size={48} />
        </Box>
      )}
      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          left: inEditMode ? "60px" : 0,
          padding: "4px 12px",
          fontSize: "12px",
          bgcolor: "rgba(88, 88, 88, 0.5)",
          borderRadius: "3px 3px 0 0",
          pointerEvents: "none",
          userSelect: "none",
          boxShadow: 4,
          zIndex: FRONT_UI_ZIDX,
        }}
      >
        {selectedFile
          ? selectedFile.path
          : `No file selected${inEditMode && isDeveloper ? ". Progress will not be saved!" : ""}`}
      </Box>
    </div>
  );
};

export { GridZoneComp };
