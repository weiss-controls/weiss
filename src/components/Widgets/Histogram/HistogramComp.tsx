// SPDX-License-Identifier: GPL-3.0-or-later
// Histogram widget for WEISS
// Contributed by Elmaddin Guliyev

import React, { useEffect, useMemo, useRef } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import Plot from "react-plotly.js";
import { COLORS } from "@src/constants/constants";
import { getPVHistory, registerPVHistory } from "@src/utils/historyBuffers";
import AlarmBorder from "@src/components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";

const HistogramComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { inEditMode } = useUIContext();
  const p = data.editableProperties;
  const bufferSize: number = p.plotBufferSize?.value ?? 500;
  const barColor: string = p.barColor?.value ?? COLORS.highlighted;
  const pvData = data.pvData;
  const alarmData = pvData?.alarm;

  const textHAlign = p.textHAlign?.value;
  const textVAlign = p.textVAlign?.value;
  const titleXpos = textHAlign === "left" ? 0.05 : textHAlign === "right" ? 0.95 : 0.5;
  const titleYpos = textVAlign === "bottom" ? 0.05 : textVAlign === "middle" ? 0.5 : 0.95;

  const valueBuffer = useRef<number[]>([]);
  const plotData = useRef<Plotly.Data[]>([{}]);

  // Only accumulate scalar history for the PV this histogram actually needs.
  const pvName = pvData?.pv;
  const isScalar = typeof pvData?.value === "number";
  useEffect(() => {
    if (inEditMode || !pvName || !isScalar) return;
    return registerPVHistory(pvName, bufferSize);
  }, [inEditMode, pvName, isScalar, bufferSize]);

  // build (once) a normal distribution for preview
  const preview = useMemo(() => {
    const minValue = 0;
    const maxValue = 100;
    const mean = 50;
    const stdDev = 15;
    const sampleScale = 100;
    const data: number[] = [];
    for (let x = minValue; x <= maxValue; x++) {
      const normalizedDistance = (x - mean) / stdDev;
      const pdf = Math.exp(-0.5 * normalizedDistance ** 2);
      const count = Math.round(pdf * sampleScale);

      for (let i = 0; i < count; i++) {
        data.push(x);
      }
    }
    return data;
  }, []);

  const buildPreviewTraces = () => {
    plotData.current = [
      {
        x: preview,
        type: "histogram",
        marker: { color: barColor },
      } as Plotly.Data,
    ];
  };

  const buildRuntimeTraces = () => {
    if (!pvData) return;
    const value = pvData.value;

    if (Array.isArray(value)) {
      plotData.current = [
        {
          x: [...(value as number[])],
          type: "histogram",
          marker: { color: barColor },
        } as Plotly.Data,
      ];
    } else if (typeof value === "number") {
      // Lossless history buffer: accumulated on every WS message, independent of render throttling.
      valueBuffer.current = getPVHistory(pvData.pv)
        .slice(-bufferSize)
        .map(([, v]) => v);
      plotData.current = [
        {
          x: [...valueBuffer.current],
          type: "histogram",
          marker: { color: barColor },
        } as Plotly.Data,
      ];
    }
  };

  if (inEditMode) {
    buildPreviewTraces();
  } else {
    buildRuntimeTraces();
  }

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
        text: p.yAxisTitle?.value ?? "Count",
        font: {
          family: p.fontFamily?.value,
          size: (p.fontSize?.value ?? 12) - 2,
          color: COLORS.lightGray,
        },
      },
    },
    bargap: 0.05,
    paper_bgcolor: p.backgroundColor?.value,
    plot_bgcolor: p.backgroundColor?.value,
    margin: { b: 45, l: 45, t: 50, r: 30 },
    width: p.width?.value,
    height: p.height?.value,
    showlegend: false,
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
            displaylogo: false,
            staticPlot: inEditMode,
          }}
        />
      </div>
    </AlarmBorder>
  );
};

export { HistogramComp };
