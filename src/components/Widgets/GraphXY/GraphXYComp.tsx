// SPDX-License-Identifier: GPL-3.0-or-later
// GraphXY widget — X vs Y scatter/line plot for WEISS
// Contributed by Elmaddin Guliyev

import React, { useEffect, useRef } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import Plot from "react-plotly.js";
import { COLORS } from "@src/constants/constants";
import type { TimeStamp } from "@src/types/epicsWS";
import AlarmBorder from "@src/components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";

type ScalarPoint = [number, number];

const toEpochMillis = (ts: TimeStamp): number =>
  ts.secondsPastEpoch * 1000 + Math.trunc(ts.nanoseconds / 1_000_000);

/**
 * GraphXY — Plots PV values against each other.
 *
 * When two PVs are provided, the first is used as X and the second as Y.
 * When more than two are provided, the first PV is the shared X axis
 * and each subsequent PV is a separate Y trace.
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
  const valueBuffers = useRef<Record<string, ScalarPoint[]>>({});
  const prevPvTimestamps = useRef<Record<string, TimeStamp>>({});
  const plotData = useRef<Plotly.Data[]>([]);
  const xLabel = pvNames.length > 0 ? pvNames[0] : "X";
  const awaitingFreshDataRef = useRef(false);

  useEffect(() => {
    // Since browser may keep page inactive when losing focus, reset the runtime buffers
    // for scalar PVs to avoid showing a false "gap" in the data when the page is re-focused.
    const resetRuntimeBuffers = () => {
      valueBuffers.current = {};
      prevPvTimestamps.current = {};
      awaitingFreshDataRef.current = true;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        resetRuntimeBuffers();
      }
    };

    window.addEventListener("focus", resetRuntimeBuffers);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", resetRuntimeBuffers);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const buildPreviewTraces = () => {
    plotData.current = [{}];
    valueBuffers.current = {};
    const previewPvs = pvNames.length > 0 ? pvNames : ["X PV", "Y PV"];
    if (previewPvs.length >= 2) {
      const xPreview = [1, 2, 3, 4, 5, 6, 7, 8];
      for (let i = 1; i < previewPvs.length; i++) {
        const yPreview = xPreview.map((v) => v * (1 + i * 0.3) + Math.sin(v * i) * 2);
        plotData.current.push({
          x: xPreview,
          y: yPreview,
          type: "scatter",
          mode: plotLineStyle as Plotly.PlotData["mode"],
          line: { color: lineColors?.[i - 1] ?? "auto" },
          marker: { size: 6 },
          name: `${previewPvs[0]} vs ${previewPvs[i]}`,
        });
      }
    }
  };

  const buildRuntimeTraces = () => {
    if (!pvData) return;
    let updated = false;
    for (const [pvName, pv] of Object.entries(pvData)) {
      const newValTs = pv.timeStamp;
      const oldValTs = prevPvTimestamps.current[pvName];
      if (newValTs === oldValTs) continue;
      prevPvTimestamps.current[pvName] = newValTs;
      updated = true;
      const newVal = pv.value;
      if (typeof newVal === "number") {
        if (!valueBuffers.current[pvName]) valueBuffers.current[pvName] = [];
        const buf = valueBuffers.current[pvName];
        buf.push([toEpochMillis(newValTs), newVal]);
        if (buf.length > bufferSize) buf.shift();
      }
    }

    if (!updated) return;

    const xPvName = pvNames[0];
    const xPv = pvData[xPvName];
    if (!xPv) return;

    const xVal = xPv.value;
    const xData =
      typeof xVal === "number"
        ? (valueBuffers.current[xPvName] ?? []).map(([, v]) => v)
        : Array.isArray(xVal)
          ? [...(xVal as number[])]
          : null;

    if (!xData || xData.length === 0) return;

    const newTraces: Plotly.Data[] = [];
    for (let i = 1; i < pvNames.length; i++) {
      const yPvName = pvNames[i];
      const yPv = pvData[yPvName];
      if (!yPv) continue;

      const yVal = yPv.value;
      const yData =
        typeof yVal === "number"
          ? (valueBuffers.current[yPvName] ?? []).map(([, v]) => v)
          : Array.isArray(yVal)
            ? [...(yVal as number[])]
            : null;

      if (!yData || yData.length === 0) continue;

      const len = Math.min(xData.length, yData.length);

      newTraces.push({
        x: xData.slice(-len),
        y: yData.slice(-len),
        type: "scatter",
        mode: plotLineStyle as Plotly.PlotData["mode"],
        line: { color: lineColors?.[i - 1] ?? "auto" },
        marker: { size: 5 },
        name: `${yPvName}`,
      });
    }

    if (newTraces.length > 0) {
      plotData.current = newTraces;
    }
  };

  if (inEditMode) {
    buildPreviewTraces();
  } else {
    buildRuntimeTraces();
  }

  // Layout
  const layout: Partial<Plotly.Layout> = {
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
  };

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
          data={plotData.current}
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
