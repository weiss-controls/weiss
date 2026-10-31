// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import { useUIStore } from "@src/stores/uiStore";
import { Placeholder } from "@components/Widgets/shared/Placeholder";
import { AdController, type AdStatus } from "./adWorkerClient";
import { Colorbar, type ColorbarHandle } from "./Colorbar";
import { storeFrameSource } from "./frameSource";
import { getPreviewImage } from "./preview";
import { FIT, type Orientation, type Size, capPixelRatio, toOrientation } from "./viewport";
import { drawView } from "./worker/draw";
import { type RenderParams, type RenderResult, toRenderParams } from "./worker/render";

const FILL = { position: "absolute", inset: 0 } as const;

const WARNING_STYLE = {
  position: "absolute",
  top: 4,
  left: 4,
  right: 4,
  padding: "2px 6px",
  borderRadius: 2,
  background: "rgba(120, 80, 0, 0.85)",
  color: "white",
  font: "12px sans-serif",
  pointerEvents: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

interface PreviewProps {
  orientation: Orientation;
  params: RenderParams;
  onRendered: (result: RenderResult) => void;
}

/** Edit-mode stand-in, shown at fit with the configured orientation and no interaction */
const Preview: React.FC<PreviewProps> = ({ orientation, params, onRendered }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() =>
      setSize({ width: canvas.offsetWidth, height: canvas.offsetHeight }),
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const { rotation, flipX, flipY } = orientation;
  const { colorMap, scale } = params;
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const ratio = capPixelRatio(size, window.devicePixelRatio);
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    const preview = getPreviewImage(colorMap, scale);
    drawView(context, preview.canvas, size, { rotation, flipX, flipY }, FIT);
    onRendered(preview.result);
  }, [size, rotation, flipX, flipY, colorMap, scale, onRendered]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
};

function statusLabel(status: AdStatus): string | null {
  switch (status.kind) {
    case "image":
      return null;
    case "waiting":
      return "Waiting for image data";
    case "disconnected":
      return "Disconnected";
    case "rejected":
      return status.message;
  }
}

const AreaDetectorComp: React.FC<WidgetUpdate> = ({ data }) => {
  const inEditMode = useUIStore((s) => s.inEditMode);
  const p = data.editableProperties;
  const pvName = data.pvData?.pv ?? data.runtimePVName ?? "";
  const rotation = p.imageRotation?.value;
  const flipX = p.imageFlipX?.value;
  const flipY = p.imageFlipY?.value;
  const orientation = useMemo(
    () => toOrientation(rotation, flipX, flipY),
    [rotation, flipX, flipY],
  );

  // Resolved shape PVs of a plain waveform image (see the size PV properties)
  const sizeXPV = data.runtimeAuxPVs?.sizeXPV;
  const sizeYPV = data.runtimeAuxPVs?.sizeYPV;
  const dataTypePV = data.runtimeAuxPVs?.dataTypePV;

  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AdController | null>(null);
  const colorMap = p.colorMap?.value;
  const autoLimits = p.autoLimits?.value;
  const min = p.min?.value;
  const max = p.max?.value;
  const logIntensity = p.logIntensity?.value;
  const params = useMemo(
    () => toRenderParams(colorMap, autoLimits, min, max, logIntensity),
    [colorMap, autoLimits, min, max, logIntensity],
  );

  // Read when a controller is created; later changes go through the setters
  const orientationRef = useRef(orientation);
  orientationRef.current = orientation;
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const showReadout = p.showPixelReadout?.value ?? true;
  const showReadoutRef = useRef(showReadout);
  showReadoutRef.current = showReadout;
  const [status, setStatus] = useState<AdStatus>({ kind: "waiting" });

  // Latest stats, for a colorbar mounted later
  const statsRef = useRef<RenderResult | null>(null);
  const colorbarRef = useRef<ColorbarHandle>(null);
  const handleStats = useCallback((stats: RenderResult | null) => {
    statsRef.current = stats;
    colorbarRef.current?.update(stats);
  }, []);
  const showColorbar =
    (p.showColorbar?.value ?? true) && !(status.kind === "image" && status.color === "rgb");
  useEffect(() => {
    if (showColorbar) colorbarRef.current?.update(statsRef.current);
  }, [showColorbar]);

  // The controller (and its worker) only lives while the widget is shown at runtime
  useEffect(() => {
    const container = containerRef.current;
    if (inEditMode || !pvName || !container) return;
    const controller = new AdController(container, pvName, storeFrameSource, {
      orientation: orientationRef.current,
      params: paramsRef.current,
      shapePVs: { sizeX: sizeXPV, sizeY: sizeYPV, dataType: dataTypePV },
      onStatus: setStatus,
      onStats: handleStats,
    });
    controller.setReadoutEnabled(showReadoutRef.current);
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [inEditMode, pvName, sizeXPV, sizeYPV, dataTypePV, handleStats]);

  // Passed to the running controller (rules can change them at runtime)
  useEffect(() => {
    controllerRef.current?.setOrientation(orientation);
  }, [orientation]);

  useEffect(() => {
    controllerRef.current?.setParams(params);
  }, [params]);

  useEffect(() => {
    controllerRef.current?.setReadoutEnabled(showReadout);
  }, [showReadout]);

  const label = inEditMode ? null : !pvName ? "No PV configured" : statusLabel(status);

  return (
    <div
      title={p.tooltip?.value ?? ""}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        backgroundColor: p.backgroundColor?.value,
        borderRadius: p.borderRadius?.value,
        borderStyle: p.borderStyle?.value,
        borderWidth: p.borderWidth?.value,
        borderColor: p.borderColor?.value,
        overflow: "hidden",
      }}
    >
      {/* The colorbar has its own strip beside the image */}
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          {inEditMode ? (
            <Preview orientation={orientation} params={params} onRendered={handleStats} />
          ) : (
            <div ref={containerRef} style={FILL} />
          )}
        </div>
        {showColorbar && (
          <Colorbar
            ref={colorbarRef}
            colorMap={params.colorMap}
            requestedLog={params.scale === "log"}
            fontSize={p.fontSize?.value ?? 11}
            textColor={p.textColor?.value ?? "white"}
          />
        )}
      </div>
      {label && (
        <div style={FILL}>
          <Placeholder label={label} />
        </div>
      )}
      {!inEditMode && status.kind === "image" && status.warning && (
        <div style={WARNING_STYLE} title={status.warning}>
          {status.warning}
        </div>
      )}
    </div>
  );
};

export { AreaDetectorComp };
