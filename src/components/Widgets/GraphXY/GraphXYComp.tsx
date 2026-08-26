// SPDX-License-Identifier: GPL-3.0-or-later
// GraphXY widget — X vs Y scatter/line plot for WEISS
// Contributed by Elmaddin Guliyev

import React, { useEffect, useMemo } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import { COLORS } from "@src/constants/constants";
import { getPVHistory, registerPVHistory } from "@src/utils/historyBuffers";
import AlarmBorder from "@src/components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";
import ReactECharts from "echarts-for-react";
import type { EChartsOption, SeriesOption } from "echarts";

type ScalarPoint = [number, number];

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

  const lineColors = p.lineColors?.value ?? [];
  const pvNames: string[] = p.pvNames?.value ?? [];
  const bufferSize: number = p.plotBufferSize?.value ?? 50;
  const plotLineStyle: string = p.plotLineStyle?.value ?? "lines+markers";
  // Backward-compatibility: map ECharts plot type to legacy plotly plotLineStyle property
  const plotType = plotLineStyle === "markers" ? "scatter" : "line";
  const showSymbols = plotLineStyle !== "lines";
  const showLegend = p.showLegend?.value;
  const xLabel = pvNames.length > 0 ? pvNames[0] : "X";
  const legendHAlign = p.legendHAlign?.value;
  const legendVAlign = p.legendVAlign?.value;
  const titleHAlign = p.textHAlign?.value;
  const titleVAlign = p.textVAlign?.value;
  const allInTop = showLegend && legendVAlign === "top" && titleVAlign === "top";
  const allInBottom = showLegend && legendVAlign === "bottom" && titleVAlign === "bottom";
  const gridTop = allInTop ? 80 : titleVAlign === "top" ? 70 : 40;
  const gridBottom = allInBottom ? 80 : titleVAlign === "bottom" ? 70 : 45;

  const titlePadding = useMemo(
    () => [
      titleVAlign === "top" ? 20 : 0,
      titleHAlign === "right" ? 50 : 0,
      titleVAlign === "bottom" ? 15 : 0,
      titleHAlign === "left" ? 50 : 0,
    ],
    [titleVAlign, titleHAlign],
  );
  const legendPadding = useMemo(
    () => [
      legendVAlign === "top" ? 50 : 0,
      legendHAlign === "right" ? 50 : 0,
      showLegend && legendVAlign === "bottom" ? (allInBottom ? 35 : 5) : 0,
      legendHAlign === "left" ? 50 : 0,
    ],
    [legendVAlign, legendHAlign, showLegend, allInBottom],
  );

  // Only accumulate scalar history for PVs that actually carry scalar values.
  const scalarPvNames = pvNames.filter((pv) => typeof pvData[pv]?.value === "number");
  const scalarPvNamesKey = scalarPvNames.join(",");
  useEffect(() => {
    if (inEditMode || !scalarPvNames.length) return;
    const unregisters = scalarPvNames.map((pv) => registerPVHistory(pv, bufferSize));
    return () => unregisters.forEach((unregister) => unregister());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scalarPvNamesKey is the stable identity for scalarPvNames
  }, [inEditMode, scalarPvNamesKey, bufferSize]);

  const buildPreviewSeries = (): SeriesOption[] => {
    const previewPvs = pvNames.length > 0 ? pvNames : ["X PV", "Y PV"];
    if (previewPvs.length < 2) return [];

    const xPreview = [0, 1, 2, 3];

    return previewPvs.slice(1).map((pvName, idx) => {
      const base = idx * 0.5;
      const yPreview = [base, base + 3, base + 2, base + 5];
      return {
        type: plotType,
        showSymbol: showSymbols,
        data: xPreview.map((x, pointIdx) => [x, yPreview[pointIdx]]),
        lineStyle: { color: lineColors[idx] },
        itemStyle: { color: lineColors[idx] },
        name: `${previewPvs[0]} vs ${pvName}`,
      } as SeriesOption;
    });
  };

  const buildRuntimeSeries = (): SeriesOption[] => {
    if (!pvData) return [];

    // Lossless history buffer: accumulated on every WS message, independent of render throttling.
    const getBuffer = (pvName: string): ScalarPoint[] => getPVHistory(pvName).slice(-bufferSize);

    const xPvName = pvNames[0];
    const xPv = pvData[xPvName];
    if (!xPv) return [];

    const xVal = xPv.value;
    const xData =
      typeof xVal === "number"
        ? getBuffer(xPvName).map(([, v]) => v)
        : Array.isArray(xVal)
          ? [...(xVal as number[])]
          : null;

    if (!xData || xData.length === 0) return [];

    const newSeries: SeriesOption[] = [];
    for (let i = 1; i < pvNames.length; i++) {
      const yPvName = pvNames[i];
      const yPv = pvData[yPvName];
      if (!yPv) continue;

      const yVal = yPv.value;
      const yData =
        typeof yVal === "number"
          ? getBuffer(yPvName).map(([, v]) => v)
          : Array.isArray(yVal)
            ? [...(yVal as number[])]
            : null;

      if (!yData || yData.length === 0) continue;

      const len = Math.min(xData.length, yData.length);
      const xSlice = xData.slice(-len);
      const ySlice = yData.slice(-len);

      newSeries.push({
        type: plotType,
        showSymbol: showSymbols,
        data: xSlice.map((x, idx) => [x, ySlice[idx]]),
        lineStyle: { color: lineColors[i - 1] },
        itemStyle: { color: lineColors[i - 1] },
        name: `${pvNames[0]} vs ${pvNames[i]}`,
      } as SeriesOption);
    }

    return newSeries;
  };

  const series = inEditMode ? buildPreviewSeries() : buildRuntimeSeries();

  const option = useMemo<EChartsOption>(() => {
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
        axisPointer: { type: "cross" },
      },
      legend: {
        selectedMode: inEditMode ? false : "multiple",
        show: showLegend,
        top: legendVAlign,
        left: legendHAlign,
        orient: p.legendOrient?.value as "horizontal" | "vertical",
        align: "auto",
        padding: legendPadding,
      },
      grid: {
        left: 50,
        right: 50,
        top: gridTop,
        bottom: gridBottom,
      },
      toolbox: {
        feature: {
          restore: { show: !inEditMode },
          saveAsImage: { name: p.plotTitle?.value, show: !inEditMode },
          dataZoom: { show: !inEditMode, yAxisIndex: "none" },
        },
      },
      xAxis: {
        type: "value",
        min: "dataMin",
        max: "dataMax",
        name: p.xAxisTitle?.value ?? xLabel,
        nameTextStyle: {
          color: COLORS.lightGray,
          fontSize: (p.fontSize?.value ?? 12) - 2,
        },
        axisLabel: { color: COLORS.lightGray },
        splitLine: { show: false },
      },
      yAxis: {
        type: p.logscaleY?.value ? "log" : "value",
        min: "dataMin",
        max: "dataMax",
        name: p.yAxisTitle?.value,
        nameTextStyle: {
          color: COLORS.lightGray,
          fontSize: (p.fontSize?.value ?? 12) - 2,
        },
        axisLabel: { color: COLORS.lightGray },
        splitLine: { lineStyle: { color: COLORS.gridLineColor } },
      },
      series,
      dataZoom: [
        {
          show: !inEditMode,
          realtime: true,
          showDetail: true,
          height: 25,
        },
        {
          show: !inEditMode,
          type: "inside",
          realtime: true,
          showDetail: true,
        },
      ],
      backgroundColor: p.backgroundColor?.value,
      animation: false,
    };
  }, [
    inEditMode,
    p.backgroundColor?.value,
    p.fontBold?.value,
    p.fontFamily?.value,
    p.fontItalic?.value,
    p.fontSize?.value,
    p.logscaleY?.value,
    p.plotTitle?.value,
    p.legendOrient?.value,
    p.textColor?.value,
    p.textHAlign?.value,
    p.textVAlign?.value,
    p.xAxisTitle?.value,
    p.yAxisTitle?.value,
    xLabel,
    showLegend,
    legendVAlign,
    legendHAlign,
    series,
    titlePadding,
    legendPadding,
    gridTop,
    gridBottom,
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

export { GraphXYComp };
