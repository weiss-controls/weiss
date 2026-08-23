// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useEffect, useRef } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import Plot from "@src/utils/plotlyMinified";
import { COLORS } from "@src/constants/constants";
import { getPVHistory, registerPVHistory } from "@src/utils/historyBuffers";
import AlarmBorder from "@src/components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";

const GraphYComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { inEditMode } = useUIContext();
  const p = data.editableProperties;
  const pvData = data.multiPvData ?? {};
  const alarmData = Object.values(pvData)
    .map((d) => d.alarm)
    .filter((a) => a !== undefined);
  const lineColors = p.lineColors?.value;
  const pvNames = p.pvNames?.value;
  const bufferSize = p.plotBufferSize?.value ?? 50;
  const plotLineStyle = p.plotLineStyle?.value ?? "lines";
  const textHAlign = p.textHAlign?.value;
  const textVAlign = p.textVAlign?.value;
  const titleXpos = textHAlign == "left" ? 0.05 : textHAlign == "right" ? 0.95 : 0.5;
  const titleYpos = textVAlign == "bottom" ? 0.05 : textVAlign == "middle" ? 0.5 : 0.95;
  const plotData = useRef<Plotly.Data[]>([{}]);
  const previewPvs = pvNames ?? ["<pvname>"];

  // If PV carries only scalar values, request a buffer from PVStore
  const scalarPvNames = pvNames?.filter((pv) => typeof pvData[pv]?.value === "number") ?? [];
  const scalarPvNamesKey = scalarPvNames.join(",");
  useEffect(() => {
    if (inEditMode || !scalarPvNames.length) return;
    const unregisters = scalarPvNames.map((pv) => registerPVHistory(pv, bufferSize));
    return () => unregisters.forEach((unregister) => unregister());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scalarPvNamesKey is the stable identity for scalarPvNames
  }, [inEditMode, scalarPvNamesKey, bufferSize]);

  const buildPreviewTraces = () => {
    plotData.current = [{}];
    plotData.current = previewPvs.map((pvName, idx) => {
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
  };

  const isScalarOnlyRuntimeData =
    !inEditMode &&
    pvData &&
    Object.keys(pvData).length > 0 &&
    Object.values(pvData).every((pv) => typeof pv.value === "number");

  const buildRuntimeTraces = () => {
    if (!pvData) return;

    const traces: (Plotly.Data & { __pvIdx: number })[] = [];

    for (const [pvName, pv] of Object.entries(pvData)) {
      const pvIdx = pvNames?.indexOf(pvName) ?? -1;
      if (pvIdx === -1) continue;

      const v = pv.value;

      if (typeof v === "number") {
        const buf = getPVHistory(pvName).slice(-bufferSize);
        traces.push({
          x: buf.map(([t]) => t),
          y: buf.map(([, val]) => val),
          type: "scatter",
          mode: plotLineStyle as Plotly.PlotData["mode"],
          line: { color: lineColors?.[pvIdx] },
          name: pvName,
          __pvIdx: pvIdx,
        });
      } else if (Array.isArray(v)) {
        traces.push({
          y: [...v],
          type: "scatter",
          mode: plotLineStyle as Plotly.PlotData["mode"],
          line: { color: lineColors?.[pvIdx] },
          name: pvName,
          __pvIdx: pvIdx,
        });
      }
    }

    plotData.current = traces
      .sort((a, b) => a.__pvIdx - b.__pvIdx)
      .map(({ __pvIdx, ...trace }) => trace);
  };

  if (inEditMode) {
    buildPreviewTraces();
  } else {
    buildRuntimeTraces();
  }

  const layout: Partial<Plotly.Layout> = {
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
      type: isScalarOnlyRuntimeData ? "date" : undefined,
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
    paper_bgcolor: p.backgroundColor!.value,
    plot_bgcolor: p.backgroundColor!.value,
    margin: { b: 35, l: 35, t: 50, r: 30 },
    width: p.width!.value,
    height: p.height!.value,
    showlegend: p.showLegend!.value,
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
