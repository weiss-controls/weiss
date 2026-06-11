// SPDX-License-Identifier: GPL-3.0-or-later
// Histogram widget for WEISS
// Contributed by Elmaddin Guliyev

import React, { useEffect, useState, useRef } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import Plot from "react-plotly.js";
import { COLORS } from "@src/constants/constants";
import type { TimeStamp } from "@src/types/epicsWS";
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
  const prevTimestamp = useRef<TimeStamp | undefined>(undefined);
  const [plotData, setPlotData] = useState<Plotly.Data[]>([]);
  const [layout, setLayout] = useState<Partial<Plotly.Layout>>({});

  useEffect(() => {
    if (inEditMode) {
      valueBuffer.current = [];
      const preview: number[] = [];
      for (let i = 0; i < 200; i++) {
        preview.push(
          50 + 15 * Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random()),
        );
      }
      setPlotData([
        {
          x: preview,
          type: "histogram",
          marker: { color: barColor },
        } as Plotly.Data,
      ]);
      return;
    }

    if (!pvData) return;

    const newTs = pvData.timeStamp;
    if (newTs === prevTimestamp.current) return;
    prevTimestamp.current = newTs;

    const value = pvData.value;

    if (Array.isArray(value)) {
      setPlotData([
        {
          x: [...(value as number[])],
          type: "histogram",
          marker: { color: barColor },
        } as Plotly.Data,
      ]);
    } else if (typeof value === "number") {
      valueBuffer.current.push(value);
      if (valueBuffer.current.length > bufferSize) {
        valueBuffer.current = valueBuffer.current.slice(-bufferSize);
      }
      setPlotData([
        {
          x: [...valueBuffer.current],
          type: "histogram",
          marker: { color: barColor },
        } as Plotly.Data,
      ]);
    }
  }, [inEditMode, pvData, bufferSize, barColor]);

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

export { HistogramComp };
