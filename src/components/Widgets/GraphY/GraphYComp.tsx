// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useEffect, useMemo } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import { COLORS } from "@src/constants/constants";
import { getPVHistory, registerPVHistory } from "@src/utils/historyBuffers";
import AlarmBorder from "@src/components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";
import ReactECharts from "echarts-for-react";
import type { EChartsOption, SeriesOption } from "echarts";

const GraphYComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { inEditMode } = useUIContext();
  const p = data.editableProperties;
  const pvData = useMemo(() => data.multiPvData ?? {}, [data.multiPvData]);
  const alarmData = Object.values(pvData)
    .map((d) => d.alarm)
    .filter((a) => a !== undefined);
  const lineColors = useMemo(() => p.lineColors?.value ?? [], [p.lineColors?.value]);
  const pvNames = useMemo(() => p.pvNames?.value ?? [], [p.pvNames?.value]);
  const bufferSize = p.plotBufferSize?.value ?? 50;
  // Backward-compatibility: map ECharts plot type to legacy plotly plotLineStyle property
  const plotType = p.plotLineStyle?.value == "markers" ? "scatter" : "line";
  const showSymbols = p.plotLineStyle?.value !== "lines";
  const showLegend = p.showLegend?.value;
  const titleHAlign = p.textHAlign?.value;
  const titleVAlign = p.textVAlign?.value;
  const legendHAlign = p.legendHAlign?.value;
  const legendVAlign = p.legendVAlign?.value;
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

  // If PV carries only scalar values, request a buffer from PVStore
  const scalarPvNames = pvNames?.filter((pv) => typeof pvData[pv]?.value === "number") ?? [];
  const scalarPvNamesKey = scalarPvNames.join(",");
  useEffect(() => {
    if (inEditMode || !scalarPvNames.length) return;
    const unregisters = scalarPvNames.map((pv) => registerPVHistory(pv, bufferSize));
    return () => unregisters.forEach((unregister) => unregister());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scalarPvNamesKey is the stable identity for scalarPvNames
  }, [inEditMode, scalarPvNamesKey, bufferSize]);

  const buildPreviewSeries = (): SeriesOption[] => {
    const previewPvs = pvNames ?? ["<pvname>"];
    return previewPvs.map((pvName, idx) => {
      const base = idx * 0.5;
      const values = [base, base + 3, base + 2, base + 5];
      return {
        type: plotType,
        showSymbol: showSymbols,
        data: values.map((value, index) => [index, value]),
        lineStyle: { color: lineColors[idx] },
        itemStyle: { color: lineColors[idx] },
        name: pvName,
      } as SeriesOption;
    });
  };

  const isScalarOnlyRuntimeData =
    !inEditMode &&
    !!pvData &&
    Object.keys(pvData).length > 0 &&
    Object.values(pvData).every((pv) => typeof pv.value === "number");

  const buildRuntimeSeries = (): SeriesOption[] => {
    if (!pvData) return [];

    const orderedPvNames = pvNames.length > 0 ? pvNames : Object.keys(pvData);

    return orderedPvNames
      .map((pvName) => {
        const pv = pvData[pvName];
        if (!pv) return null;

        const rawValue = pv.value;
        const points =
          typeof rawValue === "number"
            ? [...(getPVHistory(pvName).slice(-bufferSize) ?? [])]
            : Array.isArray(rawValue)
              ? [...rawValue]
              : null;

        if (!points) return null;

        const pvIndex = pvNames.indexOf(pvName);
        const color = lineColors[pvIndex]; // Gets a random color if not defined
        const seriesData =
          typeof rawValue === "number"
            ? points
            : (points as number[]).map((value, index) => [index, value]);

        return {
          name: pvName,
          type: plotType,
          showSymbol: showSymbols,
          data: seriesData,
          lineStyle: { color },
          itemStyle: { color },
        } as SeriesOption;
      })
      .filter((series): series is SeriesOption => series !== null);
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
        type: isScalarOnlyRuntimeData ? "time" : "value",
        name: p.xAxisTitle?.value,
        nameTextStyle: {
          color: COLORS.lightGray,
          fontSize: (p.fontSize?.value ?? 12) - 2,
        },
        axisLabel: { color: COLORS.lightGray },
        splitLine: { show: false },
      },
      yAxis: {
        type: p.logscaleY?.value ? "log" : "value",
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
    isScalarOnlyRuntimeData,
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

export { GraphYComp };
