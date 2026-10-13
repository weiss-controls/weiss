// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import { useUIContext } from "@src/context/useUIContext";
import { Placeholder } from "@components/Widgets/shared/Placeholder";
import { AdController, type AdStatus } from "./adWorkerClient";
import { pvStoreFrameSource } from "./frameSource";
import { getPreviewImage } from "./preview";
import { FIT, type Orientation, type Size, capPixelRatio, toOrientation } from "./viewport";
import { drawView } from "./worker/draw";

const FILL = { position: "absolute", inset: 0 } as const;

/** Edit-mode stand-in, shown at fit with the configured orientation and no interaction */
const Preview: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
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
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const ratio = capPixelRatio(size, window.devicePixelRatio);
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    drawView(context, getPreviewImage(), size, { rotation, flipX, flipY }, FIT);
  }, [size, rotation, flipX, flipY]);

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
    case "rejected":
      return status.message;
  }
}

const AreaDetectorComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { inEditMode } = useUIContext();
  const p = data.editableProperties;
  const visible = p.visible?.value;
  const pvName = data.pvData?.pv ?? data.runtimePVName ?? "";
  const rotation = p.imageRotation?.value;
  const flipX = p.imageFlipX?.value;
  const flipY = p.imageFlipY?.value;
  const orientation = useMemo(
    () => toOrientation(rotation, flipX, flipY),
    [rotation, flipX, flipY],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AdController | null>(null);
  // Read when a controller is created; later changes go through setOrientation
  const orientationRef = useRef(orientation);
  orientationRef.current = orientation;
  const [status, setStatus] = useState<AdStatus>({ kind: "waiting" });

  // The controller (and its worker) only lives while the widget is shown at runtime
  useEffect(() => {
    const container = containerRef.current;
    if (inEditMode || !visible || !pvName || !container) return;
    const controller = new AdController(
      container,
      pvName,
      pvStoreFrameSource,
      orientationRef.current,
      setStatus,
    );
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [inEditMode, visible, pvName]);

  // Rules can change the orientation at runtime; the worker is kept
  useEffect(() => {
    controllerRef.current?.setOrientation(orientation);
  }, [orientation]);

  if (!visible) return null;

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
      {inEditMode ? <Preview orientation={orientation} /> : <div ref={containerRef} style={FILL} />}
      {label && (
        <div style={FILL}>
          <Placeholder label={label} />
        </div>
      )}
    </div>
  );
};

export { AreaDetectorComp };
