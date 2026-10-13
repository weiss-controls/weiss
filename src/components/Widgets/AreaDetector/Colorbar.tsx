// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useEffect, useImperativeHandle, useRef } from "react";
import { formatValue } from "./format";
import { type ColorMapName, getColorTable } from "./worker/colorMaps";
import { LEVELS } from "./worker/intensity";
import type { RenderResult } from "./worker/render";

/** Label updates go straight to the DOM, so frames never re-render React */
export interface ColorbarHandle {
  update: (result: RenderResult | null) => void;
}

interface ColorbarProps {
  colorMap: ColorMapName;
  /** Log was asked for; shown when the image fell back to linear */
  requestedLog: boolean;
  fontSize: number;
  textColor: string;
  ref?: React.Ref<ColorbarHandle>;
}

const BAR_WIDTH = 12;
const GAP = 4;
// Wide enough for formatValue's longest usual output; fixed so changing labels never resize the image
const LABEL_CHARS = 10;

/** Fixed-width strip beside the image: the colormap from the maximum (top) to the minimum */
export const Colorbar: React.FC<ColorbarProps> = ({
  colorMap,
  requestedLog,
  fontSize,
  textColor,
  ref,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maxRef = useRef<HTMLSpanElement>(null);
  const noteRef = useRef<HTMLSpanElement>(null);
  const minRef = useRef<HTMLSpanElement>(null);
  const requestedLogRef = useRef(requestedLog);
  requestedLogRef.current = requestedLog;

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const table = getColorTable(colorMap);
    const image = new ImageData(1, LEVELS);
    for (let level = 0; level < LEVELS; level++) {
      image.data.set(table.subarray(level * 4, level * 4 + 4), (LEVELS - 1 - level) * 4);
    }
    context.putImageData(image, 0, 0);
  }, [colorMap]);

  useImperativeHandle(
    ref,
    () => ({
      update: (result) => {
        const [max, note, min] = [maxRef.current, noteRef.current, minRef.current];
        if (!max || !note || !min) return;
        const limits = result?.limits;
        max.textContent = limits ? formatValue(limits.max) : "";
        min.textContent = limits ? formatValue(limits.min) : "";
        if (result?.limitsMode === "autoFallback") {
          note.textContent = "auto*";
          note.title = "The fixed limits are invalid; automatic limits are used";
        } else if (result?.scale === "log") {
          note.textContent = "log";
          note.title = "";
        } else if (result && requestedLogRef.current) {
          note.textContent = "linear*";
          note.title = "A log scale needs positive limits; a linear scale is used";
        } else {
          note.textContent = "";
          note.title = "";
        }
      },
    }),
    [],
  );

  const label: React.CSSProperties = {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  return (
    <div
      style={{
        display: "flex",
        flex: "none",
        boxSizing: "border-box",
        padding: GAP,
        gap: GAP,
        height: "100%",
        fontFamily: "monospace",
        fontSize,
        color: textColor,
      }}
    >
      <canvas
        ref={canvasRef}
        width={1}
        height={LEVELS}
        style={{ display: "block", width: BAR_WIDTH, height: "100%" }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: `${LABEL_CHARS}ch`,
        }}
      >
        <span ref={maxRef} style={label} />
        <span ref={noteRef} style={label} />
        <span ref={minRef} style={label} />
      </div>
    </div>
  );
};
