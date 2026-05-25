// SPDX-License-Identifier: GPL-3.0-or-later
// GraphXY widget — X vs Y scatter/line plot for WEISS
// Contributed by Elmaddin Guliyev

import React, { useEffect, useState, useRef } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import Plot from "react-plotly.js";
import { COLORS } from "@src/constants/constants";
import type { TimeStamp } from "@src/types/epicsWS";
import AlarmBorder from "@src/components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";

/**
 * GraphXY — Plots PV values against each other.
 *
 * When two PVs are provided, the first is used as X and the second as Y.
 * When more than two are provided, the first PV is the shared X axis
 * and each subsequent PV is a separate Y trace.
 * When a single PV contains an array, it is plotted as Y with index as X.
 */
const GraphXYComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { inEditMode } = useUIContext();
  const p = data.editableProperties;
  const pvData = data.multiPvData ?? {};
  const alarmData = Object.values(pvData)
    .map((d) => d.alarm)
    .filter((a) => a !== undefined);

  const lineColors = p.lineColors?.value;
  const pvNames: string[] = React.useMemo(() => p.pvNames?.value ?? [], [p.pvNames?.value]);
  const bufferSize: number = p.plotBufferSize?.value ?? 50;
  const plotLineStyle: string = p.plotLineStyle?.value ?? "lines+markers";
  const textHAlign = p.textHAlign?.value;
  const textVAlign = p.textVAlign?.value;
  const titleXpos = textHAlign === "left" ? 0.05 : textHAlign === "right" ? 0.95 : 0.5;
  const titleYpos = textVAlign === "bottom" ? 0.05 : textVAlign === "middle" ? 0.5 : 0.95;

  // Ring buffers: one per PV
  const valueBuffers = useRef<Record<string, number[]>>({});
  const prevPvTimestamps = useRef<Record<string, TimeStamp>>({});
  const [plotData, setPlotData] = useState<Plotly.Data[]>([]);
  const [layout, setLayout] = useState<Partial<Plotly.Layout>>({});

  // Build traces
  useEffect(() => {
    // Edit-mode preview
    if (inEditMode) {
      valueBuffers.current = {};
      const previewPvs = pvNames.length > 0 ? pvNames : ["X PV", "Y PV"];
      if (previewPvs.length >= 2) {
        const xPreview = [1, 2, 3, 4, 5, 6, 7, 8];
        const traces: Plotly.Data[] = [];
        for (let i = 1; i < previewPvs.length; i++) {
          const yPreview = xPreview.map((v) => v * (1 + i * 0.3) + Math.sin(v * i) * 2);
          traces.push({
            x: xPreview,
            y: yPreview,
            type: "scatter",
            mode: plotLineStyle as Plotly.PlotData["mode"],
            line: { color: lineColors?.[i - 1] ?? "auto" },
            marker: { size: 6 },
            name: `${previewPvs[0]} vs ${previewPvs[i]}`,
          });
        }
        setPlotData(traces);
      }
      return;
    }

    if (!data.multiPvData || pvNames.length < 2) return;

    // Check for new data
    let updated = false;
    for (const [pvName, pv] of Object.entries(data.multiPvData)) {
      const newValTs = pv.timeStamp;
      const oldValTs = prevPvTimestamps.current[pvName];
      if (newValTs === oldValTs) continue;
      prevPvTimestamps.current[pvName] = newValTs;
      updated = true;
      const newVal = pv.value;
      if (typeof newVal === "number") {
        if (!valueBuffers.current[pvName]) valueBuffers.current[pvName] = [];
        const buf = valueBuffers.current[pvName];
        buf.push(newVal);
        if (buf.length > bufferSize) buf.shift();
      }
    }

    if (!updated) return;

    const xPvName = pvNames[0];
    const xPv = data.multiPvData[xPvName];
    if (!xPv) return;

    // X data: either from buffer (scalar) or array
    const xVal = xPv.value;
    const xData: number[] | null =
      typeof xVal === "number"
        ? [...(valueBuffers.current[xPvName] ?? [])]
        : Array.isArray(xVal)
          ? [...(xVal as number[])]
          : null;

    if (!xData || xData.length === 0) return;

    // Build Y traces
    const traces: Plotly.Data[] = [];
    for (let i = 1; i < pvNames.length; i++) {
      const yPvName = pvNames[i];
      const yPv = data.multiPvData[yPvName];
      if (!yPv) continue;

      const yVal = yPv.value;
      const yData: number[] | null =
        typeof yVal === "number"
          ? [...(valueBuffers.current[yPvName] ?? [])]
          : Array.isArray(yVal)
            ? [...(yVal as number[])]
            : null;

      if (!yData || yData.length === 0) continue;

      // Align lengths
      const len = Math.min(xData.length, yData.length);

      traces.push({
        x: xData.slice(-len),
        y: yData.slice(-len),
        type: "scatter",
        mode: plotLineStyle as Plotly.PlotData["mode"],
        line: { color: lineColors?.[i - 1] ?? "auto" },
        marker: { size: 5 },
        name: `${yPvName}`,
      });
    }

    setPlotData(traces);
  }, [inEditMode, data.multiPvData, bufferSize, plotLineStyle, lineColors, pvNames]);

  // Layout
  useEffect(() => {
    const xLabel = pvNames.length > 0 ? pvNames[0] : "X";
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
          text: p.xAxisTitle?.value ?? xLabel,
          font: {
            family: p.fontFamily?.value,
            size: (p.fontSize?.value ?? 12) - 2,
            color: COLORS.lightGray,
          },
        },
        type: "linear",
      },
      yaxis: {
        type: p.logscaleY?.value ? "log" : "linear",
        title: {
          text: p.yAxisTitle?.value ?? "",
          font: {
            family: p.fontFamily?.value,
            size: (p.fontSize?.value ?? 12) - 2,
            color: COLORS.lightGray,
          },
        },
      },
      paper_bgcolor: p.backgroundColor?.value,
      plot_bgcolor: p.backgroundColor?.value,
      margin: { b: 45, l: 45, t: 50, r: 30 },
      width: p.width?.value,
      height: p.height?.value,
      showlegend: p.showLegend?.value,
      legend: {
        orientation: "h",
        x: 1,
        xanchor: "right",
        y: 0.975,
        bgcolor: "00000000",
      },
      uirevision: String(inEditMode),
    });
  }, [p, pvNames, inEditMode, titleXpos, titleYpos]);

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
            modeBarButtonsToRemove: ["lasso2d", "select2d"],
            displaylogo: false,
            staticPlot: inEditMode,
          }}
        />
      </div>
    </AlarmBorder>
  );
};

export { GraphXYComp };
