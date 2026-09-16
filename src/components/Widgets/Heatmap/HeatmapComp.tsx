// SPDX-License-Identifier: GPL-3.0-or-later
// Heatmap widget for WEISS — designed for areaDetector imaging
// Contributed by Elmaddin Guliyev

import React, { useMemo } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import { COLORS } from "@src/constants/constants";
import AlarmBorder from "@src/components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { echarts, type ECOption } from "@src/utils/eChartsMinified";

const COLOR_SCALES: Record<string, string[]> = {
  Viridis: ["#440154", "#414487", "#2a788e", "#22a884", "#7ad151", "#fde725"],
  Plasma: ["#0d0887", "#6a00a8", "#b12a90", "#e16462", "#fca636", "#f0f921"],
  Inferno: ["#000004", "#420a68", "#932667", "#dd513a", "#fca50a", "#fcffa4"],
  Magma: ["#000004", "#3b0f70", "#8c2981", "#de4968", "#fe9f6d", "#fcfdbf"],
  Greys: ["#ffffff", "#d9d9d9", "#bdbdbd", "#737373", "#525252", "#000000"],
  Jet: ["#000080", "#0000ff", "#00ffff", "#ffff00", "#ff0000", "#800000"],
};

const PREVIEW_SIZE = 32;

interface ImageData {
  points: [number, number, number][];
  cols: number;
  rows: number;
  min: number;
  max: number;
}

const EMPTY_IMAGE: ImageData = { points: [], cols: 0, rows: 0, min: 0, max: 1 };

/** Convert a flat array plus explicit dimensions into ECharts [x, y, value] triples. */
const buildImage = (flat: number[], cols: number, rows: number): ImageData => {
  if (cols <= 0 || rows <= 0 || flat.length === 0) return EMPTY_IMAGE;

  const points: [number, number, number][] = [];
  let min = Infinity;
  let max = -Infinity;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (idx >= flat.length) break;
      const v = flat[idx];
      points.push([col, row, v]);
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  if (points.length === 0) return EMPTY_IMAGE;
  if (min === max) max = min + 1;
  return { points, cols, rows, min, max };
};

const HeatmapComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { inEditMode } = useUIContext();
  const p = data.editableProperties;
  const pvData = data.multiPvData ?? {};
  const pvNames: string[] = p.pvNames?.value ?? [];

  const alarmData = Object.values(pvData).find((d) => (d?.alarm?.severity ?? 0) > 0)?.alarm;

  const colorScaleName: string = p.colorScale?.value ?? "Viridis";
  const colorScale = COLOR_SCALES[colorScaleName] ?? COLOR_SCALES.Viridis;

  const dimsFromPVs: boolean = p.dimsFromPVs?.value ?? true;
  const manualSizeX: number = p.imageSizeX?.value ?? 0;
  const manualSizeY: number = p.imageSizeY?.value ?? 0;

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

  // Smooth 2D gaussian so the widget looks like an image while editing.
  const preview = useMemo(() => {
    const flat: number[] = [];
    const centre = PREVIEW_SIZE / 2;
    const sigma = PREVIEW_SIZE / 5;
    for (let row = 0; row < PREVIEW_SIZE; row++) {
      for (let col = 0; col < PREVIEW_SIZE; col++) {
        const dx = (col - centre) / sigma;
        const dy = (row - centre) / sigma;
        flat.push(Math.exp(-0.5 * (dx * dx + dy * dy)) * 100);
      }
    }
    return buildImage(flat, PREVIEW_SIZE, PREVIEW_SIZE);
  }, []);

  const buildRuntimeImage = (): ImageData => {
    const dataPvName = pvNames[0];
    if (!dataPvName) return EMPTY_IMAGE;

    const value = pvData[dataPvName]?.value;
    if (!Array.isArray(value)) return EMPTY_IMAGE;
    const flat = value as number[];

    let cols: number;
    let rows: number;

    if (dimsFromPVs) {
      const sizeXValue = pvNames[1] ? pvData[pvNames[1]]?.value : undefined;
      const sizeYValue = pvNames[2] ? pvData[pvNames[2]]?.value : undefined;
      // Without both dimension PVs connected we cannot know the shape, and
      // guessing it risks displaying wrong data. Render nothing instead.
      if (typeof sizeXValue !== "number" || typeof sizeYValue !== "number") return EMPTY_IMAGE;
      cols = Math.floor(sizeXValue);
      rows = Math.floor(sizeYValue);
    } else {
      cols = Math.floor(manualSizeX);
      rows = Math.floor(manualSizeY);
    }

    if (cols <= 0 || rows <= 0) return EMPTY_IMAGE;
    return buildImage(flat, cols, rows);
  };

  const image = inEditMode ? preview : buildRuntimeImage();

  const option = useMemo<ECOption>(() => {
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
        position: "top",
      },
      grid: {
        left: 50,
        right: 80,
        top: titleVAlign === "top" ? 70 : 40,
        bottom: 45,
      },
      xAxis: {
        type: "category",
        data: Array.from({ length: image.cols }, (_, i) => String(i)),
        name: p.xAxisTitle?.value,
        nameTextStyle: {
          color: COLORS.lightGray,
          fontSize: (p.fontSize?.value ?? 12) - 2,
        },
        axisLabel: { color: COLORS.lightGray, showMaxLabel: true },
        splitArea: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: "category",
        data: Array.from({ length: image.rows }, (_, i) => String(i)),
        name: p.yAxisTitle?.value,
        nameTextStyle: {
          color: COLORS.lightGray,
          fontSize: (p.fontSize?.value ?? 12) - 2,
        },
        axisLabel: { color: COLORS.lightGray, showMaxLabel: true },
        splitArea: { show: false },
        splitLine: { show: false },
      },
      visualMap: {
        min: image.min,
        max: image.max,
        calculable: false,
        orient: "vertical",
        right: 10,
        top: "middle",
        itemHeight: 120,
        textStyle: { color: COLORS.lightGray },
        inRange: { color: colorScale },
      },
      series: [
        {
          type: "heatmap",
          data: image.points,
          progressive: 2000,
          animation: false,
          emphasis: { disabled: true },
        },
      ],
      backgroundColor: p.backgroundColor?.value,
      animation: false,
    } as ECOption;
  }, [
    image,
    colorScale,
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
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          style={{ width: "100%", height: "100%" }}
          notMerge={false}
          opts={{ devicePixelRatio: 2 }}
          lazyUpdate
        />
      </div>
    </AlarmBorder>
  );
};

export { HeatmapComp };
