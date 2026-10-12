// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useEffect, useRef, useState } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import { useUIContext } from "@src/context/useUIContext";
import { Placeholder } from "@components/Widgets/shared/Placeholder";
import { AdController, type AdStatus } from "./adWorkerClient";
import { pvStoreFrameSource } from "./frameSource";
import { PREVIEW_SIZE, getPreviewImage } from "./preview";

const FILL = { position: "absolute", inset: 0 } as const;

const Preview: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    canvasRef.current?.getContext("2d")?.putImageData(getPreviewImage(), 0, 0);
  }, []);
  return (
    <canvas
      ref={canvasRef}
      width={PREVIEW_SIZE}
      height={PREVIEW_SIZE}
      style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
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

  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<AdStatus>({ kind: "waiting" });

  // The controller (and its worker) only lives while the widget is shown at runtime
  useEffect(() => {
    const container = containerRef.current;
    if (inEditMode || !visible || !pvName || !container) return;
    const controller = new AdController(container, pvName, pvStoreFrameSource, setStatus);
    return () => controller.dispose();
  }, [inEditMode, visible, pvName]);

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
      {inEditMode ? <Preview /> : <div ref={containerRef} style={FILL} />}
      {label && (
        <div style={FILL}>
          <Placeholder label={label} />
        </div>
      )}
    </div>
  );
};

export { AreaDetectorComp };
