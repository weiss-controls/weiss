// SPDX-License-Identifier: GPL-3.0-or-later
// Heatmap widget for WEISS  designed for areaDetector imaging
// Contributed by Elmaddin Guliyev

import React, { useEffect, useState } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import Plot from "react-plotly.js";
import { COLORS } from "@src/constants/constants";
import AlarmBorder from "@src/components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";

/**
 * Heatmap — Displays 2D array PV data as a color-mapped image.
 *
 * Designed for areaDetector waveform PVs where the value is a
 * flat array representing a 2D image. The widget reshapes the
 * array into rows and columns for display.
 *
 * For a 1D array, it displays as a single-row heatmap.
 */
const HeatmapComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { inEditMode } = useUIContext();
  const p = data.editableProperties;
  const pvData = data.pvData;
  const alarmData = pvData?.alarm;

  const textHAlign = p.textHAlign?.value;
  const textVAlign = p.textVAlign?.value;
  const titleXpos = textHAlign === "left" ? 0.05 : textHAlign === "right" ? 0.95 : 0.5;
  const titleYpos = textVAlign === "bottom" ? 0.05 : textVAlign === "middle" ? 0.5 : 0.95;

  const [plotData, setPlotData] = useState<Plotly.Data[]>([]);
  const [layout, setLayout] = useState<Partial<Plotly.Layout>>({});

  // Build heatmap data
  useEffect(() => {
    if (inEditMode) {
      // Generate preview data: a gradient pattern
      const rows = 20;
      const cols = 30;
      const z: number[][] = [];
      for (let i = 0; i < rows; i++) {
        const row: number[] = [];
        for (let j = 0; j < cols; j++) {
          row.push(Math.sin(i * 0.3) * Math.cos(j * 0.3) * 50 + 50 + Math.random() * 10);
        }
        z.push(row);
      }
      setPlotData([
        {
          z,
          type: "heatmap",
          colorscale: "Viridis",
          colorbar: {
            thickness: 15,
            len: 0.8,
          },
        } as Plotly.Data,
      ]);
      return;
    }

    if (!pvData) return;

    const value = pvData.value;
    let z: number[][];

    if (Array.isArray(value) && value.length > 0) {
      const flatArray = value as number[];
      // Try to determine dimensions from the array length
      // Common areaDetector sizes: square or known aspect ratios
      const len = flatArray.length;
      const sqrt = Math.floor(Math.sqrt(len));

      // Check if it's a perfect square
      let cols: number;
      let rows: number;
      if (sqrt * sqrt === len) {
        cols = sqrt;
        rows = sqrt;
      } else {
        // Try common aspect ratios, default to a reasonable width
        cols = Math.ceil(Math.sqrt(len * 1.5));
        rows = Math.ceil(len / cols);
      }

      // Reshape flat array into 2D
      z = [];
      for (let i = 0; i < rows; i++) {
        const start = i * cols;
        const end = Math.min(start + cols, len);
        const row = flatArray.slice(start, end);
        // Pad if needed
        while (row.length < cols) row.push(0);
        z.push(row);
      }
    } else if (typeof value === "number") {
      // Single scalar — show as 1x1
      z = [[value]];
    } else {
      return;
    }

    setPlotData([
      {
        z,
        type: "heatmap",
        colorscale: "Viridis",
        colorbar: {
          thickness: 15,
          len: 0.8,
        },
      } as Plotly.Data,
    ]);
  }, [inEditMode, pvData]);

  // Layout
  useEffect(() => {
    setLayout({
      title: {
        text: p.plotTitle?.value ?? "",
        font: {
          family: p.fontFamily?.value,
          size: p.fontSize?.value,
          weight: p.fontBold?.value ? 800 : 0,
          style: p.fontItalic?.value ? "italic" : "normal",
          lineposition: p.fontUnderlined?.value ? "under" : "none",
          color: p.textColor?.value,
        },
        x: titleXpos,
        y: titleYpos,
      },
      xaxis: {
        title: {
          text: p.xAxisTitle?.value ?? "",
          font: {
            family: p.fontFamily?.value,
            size: (p.fontSize?.value ?? 12) - 2,
            color: COLORS.lightGray,
          },
        },
      },
      yaxis: {
        title: {
          text: p.yAxisTitle?.value ?? "",
          font: {
            family: p.fontFamily?.value,
            size: (p.fontSize?.value ?? 12) - 2,
            color: COLORS.lightGray,
          },
        },
        autorange: "reversed",
      },
      paper_bgcolor: p.backgroundColor?.value,
      plot_bgcolor: p.backgroundColor?.value,
      margin: { b: 45, l: 45, t: 50, r: 30 },
      width: p.width?.value,
      height: p.height?.value,
      uirevision: String(inEditMode),
    });
  }, [p, inEditMode, titleXpos, titleYpos]);

  return (
    <AlarmBorder alarmData={alarmData} enable={p.alarmBorder?.value}>
      <div
        style={{
          width: p.width?.value,
          height: p.height?.value,
          borderRadius: p.borderRadius?.value,
          borderStyle: p.borderStyle?.value,
          borderWidth: p.borderWidth?.value,
          borderColor: p.borderColor?.value,
          display: "flex",
          overflow: "hidden",
        }}
      >
        <Plot
          data={plotData}
          layout={layout}
          config={{
            responsive: true,
            displaylogo: false,
            staticPlot: inEditMode,
          }}
        />
      </div>
    </AlarmBorder>
  );
};

export { HeatmapComp };
