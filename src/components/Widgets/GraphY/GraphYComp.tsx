// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useEffect, useState, useRef } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import Plot from "react-plotly.js";
import { COLORS } from "@src/constants/constants";
import type { TimeStamp } from "@src/types/epicsWS";
import AlarmBorder from "@src/components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";

const GraphYComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { inEditMode } = useUIContext();
  const p = data.editableProperties;
  const pvData = data.multiPvData ?? {};
  const alarmData = Object.values(pvData)
    .map((p) => p.alarm)
    .filter((a) => a !== undefined);
  const lineColors = p.lineColors?.value;
  const pvNames = p.pvNames?.value;
  const bufferSize = p.plotBufferSize?.value ?? 50;
  const multiPvData = data.multiPvData;
  const plotLineStyle = p.plotLineStyle?.value ?? "lines";
  const textHAlign = p.textHAlign?.value;
  const textVAlign = p.textVAlign?.value;
  const titleXpos = textHAlign == "left" ? 0.05 : textHAlign == "right" ? 0.95 : 0.5;
  const titleYpos = textVAlign == "bottom" ? 0.05 : textVAlign == "middle" ? 0.5 : 0.95;

  const valueBuffers = useRef<Record<string, number[]>>({});
  const [plotData, setPlotData] = useState<Plotly.Data[]>([]);
  const prevPvTimestamps = useRef<Record<string, TimeStamp>>({});
  const [layout, setLayout] = useState<Partial<Plotly.Layout>>({});

  // build traces
  useEffect(() => {
    if (inEditMode) {
      valueBuffers.current = {};
      const previewPvs = pvNames ?? ["<pvname>"];
      const previewTraces = previewPvs.map((pvName, idx) => {
        const base = idx * 0.5;
        const y = [base, base + 3, base + 2, base + 5];
        return {
          y,
          type: "scatter",
          mode: plotLineStyle,
          line: { color: lineColors?.[idx] ?? "auto" },
          name: pvName,
        } as Plotly.Data;
      });
      setPlotData(previewTraces);
      return;
    }

    if (!multiPvData) return;
    let updated = false;

    for (const [pvName, pv] of Object.entries(multiPvData)) {
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

    const traces = Object.entries(multiPvData)
      .map(([pvName, pv]) => {
        const pvIdx = pvNames?.indexOf(pvName) ?? -1;
        if (pvIdx === -1) return null;

        const v = pv.value;
        const y =
          typeof v === "number"
            ? [...(valueBuffers.current[pvName] ?? [])]
            : Array.isArray(v)
              ? [...v]
              : null;

        if (!y) return null;

        return {
          y,
          type: "scatter",
          mode: plotLineStyle,
          line: { color: lineColors?.[pvIdx] },
          name: pvName,
        } as Plotly.Data;
      })
      .filter((t): t is Plotly.Data => t !== null);

    setPlotData(traces);
  }, [inEditMode, multiPvData, bufferSize, plotLineStyle, lineColors, pvNames]);

  useEffect(() => {
    setLayout({
      title: {
        text: p.plotTitle?.value,
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
          text: p.xAxisTitle?.value,
          font: {
            family: p.fontFamily?.value,
            size: (p.fontSize?.value ?? 12) - 2,
            color: COLORS.lightGray,
          },
        },
      },
      yaxis: {
        type: p.logscaleY?.value ? "log" : "linear",
        title: {
          text: p.yAxisTitle?.value,
          font: {
            family: p.fontFamily?.value,
            size: (p.fontSize?.value ?? 12) - 2,
            color: COLORS.lightGray,
          },
        },
      },
      paper_bgcolor: p.backgroundColor?.value,
      plot_bgcolor: p.backgroundColor?.value,
      margin: { b: 35, l: 35, t: 50, r: 30 },
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
            modeBarButtonsToRemove: [
              "zoom2d",
              "lasso2d",
              "zoomIn2d",
              "zoomOut2d",
              "select2d",
              "autoScale2d",
            ],
            displaylogo: false,
            staticPlot: inEditMode,
          }}
        />
      </div>
    </AlarmBorder>
  );
};

export { GraphYComp };
