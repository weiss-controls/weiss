// SPDX-License-Identifier: GPL-3.0-or-later
// Histogram widget for WEISS
// Contributed by Elmaddin Guliyev

import React, { useEffect, useMemo } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import { COLORS } from "@src/constants/constants";
import { getPVHistory, registerPVHistory } from "@src/utils/historyBuffers";
import AlarmBorder from "@src/components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";
import ReactECharts from "echarts-for-react";
import type { EChartsOption, SeriesOption } from "echarts";

const DEFAULT_BIN_COUNT = 20;

interface Bin {
  x0: number;
  x1: number;
  count: number;
}

const computeBins = (values: number[], binCount: number): Bin[] => {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max =
    Math.min(...values) === Math.max(...values) ? Math.min(...values) + 1 : Math.max(...values);
  const range = max - min;
  const binWidth = range / binCount;

  const bins: Bin[] = Array.from({ length: binCount }, (_, i) => ({
    x0: min + i * binWidth,
    x1: min + (i + 1) * binWidth,
    count: 0,
  }));

  values.forEach((v) => {
    const idx = Math.min(Math.floor((v - min) / binWidth), binCount - 1);
    bins[idx].count += 1;
  });

  return bins;
};

const HistogramComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { inEditMode } = useUIContext();
  const p = data.editableProperties;
  const bufferSize: number = p.plotBufferSize?.value ?? 500;
  const barColor: string = p.barColor?.value ?? COLORS.highlighted;
  const pvData = data.pvData;
  const alarmData = pvData?.alarm;

  const titleHAlign = p.textHAlign?.value;
  const titleVAlign = p.textVAlign?.value;
  const titlePadding = useMemo(
    () => [
      titleVAlign === "top" ? 20 : 0,
      titleHAlign === "right" ? 50 : 0,
      titleVAlign === "bottom" ? 15 : 0,
      titleHAlign === "left" ? 50 : 0,
    ],
    [titleVAlign, titleHAlign],
  );

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
    const values: number[] = [];
    for (let x = minValue; x <= maxValue; x++) {
      const normalizedDistance = (x - mean) / stdDev;
      const pdf = Math.exp(-0.5 * normalizedDistance ** 2);
      const count = Math.round(pdf * sampleScale);

      for (let i = 0; i < count; i++) {
        values.push(x);
      }
    }
    return values;
  }, []);

  const buildRuntimeBins = (): Bin[] => {
    if (!pvData) return [];
    const value = pvData.value;

    const values =
      typeof value === "number"
        ? getPVHistory(pvData.pv)
            .slice(-bufferSize)
            .map(([, v]) => v)
        : Array.isArray(value)
          ? [...(value as number[])]
          : null;

    if (!values || values.length === 0) return [];
    return computeBins(values, DEFAULT_BIN_COUNT);
  };

  const bins = inEditMode ? computeBins(preview, DEFAULT_BIN_COUNT) : buildRuntimeBins();

  const option = useMemo<EChartsOption>(() => {
    const series: SeriesOption[] = [
      {
        type: "bar",
        data: bins.map((bin) => bin.count),
        itemStyle: { color: barColor },
        barCategoryGap: "5%", // equivalent to Plotly's bargap: 0.05
      },
    ];

    return {
      title: {
        text: p.plotTitle?.value,
        left: p.textHAlign?.value,
        top: p.textVAlign?.value,
        textStyle: {
          fontFamily: p.fontFamily?.value,
          fontSize: p.fontSize?.value,
          fontWeight: p.fontBold?.value ? "bold" : "normal",
          fontStyle: p.fontItalic?.value ? "italic" : "normal",
          color: p.textColor?.value,
        },
        padding: titlePadding,
      },
      tooltip: {
        show: !inEditMode,
        trigger: "axis",
        axisPointer: { type: "shadow" },
      },
      grid: {
        left: 50,
        right: 30,
        top: titleVAlign === "top" ? 70 : 40,
        bottom: 45,
      },
      xAxis: {
        type: "category",
        data: bins.map((bin) => bin.x0.toFixed(1)),
        name: p.xAxisTitle?.value,
        nameTextStyle: {
          color: COLORS.lightGray,
          fontSize: (p.fontSize?.value ?? 12) - 2,
        },
        axisLabel: { color: COLORS.lightGray },
        axisTick: { alignWithLabel: true },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: p.yAxisTitle?.value ?? "Count",
        nameTextStyle: {
          color: COLORS.lightGray,
          fontSize: (p.fontSize?.value ?? 12) - 2,
        },
        axisLabel: { color: COLORS.lightGray },
        splitLine: { lineStyle: { color: COLORS.gridLineColor } },
      },
      series,
      backgroundColor: p.backgroundColor?.value,
      animation: false,
    };
  }, [
    bins,
    barColor,
    inEditMode,
    p.backgroundColor?.value,
    p.fontBold?.value,
    p.fontFamily?.value,
    p.fontItalic?.value,
    p.fontSize?.value,
    p.plotTitle?.value,
    p.textColor?.value,
    p.textHAlign?.value,
    p.textVAlign?.value,
    p.xAxisTitle?.value,
    p.yAxisTitle?.value,
    titlePadding,
    titleVAlign,
  ]);

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
        <ReactECharts
          option={option}
          style={{ width: "100%", height: "100%" }}
          notMerge={false}
          opts={{ devicePixelRatio: 2 }} // increase pixel density for better resolution on high-DPI screens
          lazyUpdate
        />
      </div>
    </AlarmBorder>
  );
};

export { HistogramComp };
