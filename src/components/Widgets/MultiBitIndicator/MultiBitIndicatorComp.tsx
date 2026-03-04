// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";

const MultiBitIndicatorComp: React.FC<WidgetUpdate> = ({ data }) => {
  const p = data.editableProperties;
  const pvData = data.pvData;
  const { inEditMode } = useUIContext();

  if (!p.visible?.value) return null;

  const onColor = p.onColor?.value;
  const offColor = p.offColor?.value;
  const invertOrder = p.invertBitOrder?.value;
  const value = inEditMode ? 0 : Number(pvData?.value);
  const bitsCount = p.nBits?.value ?? 1;
  const isHorizontal = p.horizontal?.value;
  const gap = Number(p.spacing?.value ?? 0);
  const containerWidth = Number(p.width?.value ?? 0);
  const containerHeight = Number(p.height?.value ?? 0);
  const mainAvailable = (isHorizontal ? containerWidth : containerHeight) - (bitsCount - 1) * gap;
  const maxCircleSize = Math.min(
    mainAvailable / bitsCount,
    isHorizontal ? containerHeight : containerWidth,
  );

  const bitSize = Math.max(maxCircleSize, 0);

  let bitIndexes = Array.from({ length: bitsCount }, (_, i) => i);
  if (invertOrder) {
    bitIndexes = bitIndexes.reverse();
  }
  const bits = bitIndexes.map((i) => {
    const bitOn = ((value >> i) & 1) === 1;
    return (
      <div
        key={i}
        style={{
          width: bitSize,
          height: bitSize,
          flexShrink: 0,
          aspectRatio: "1 / 1",
          borderRadius: p.square?.value ? 0 : "50%",
          boxSizing: "border-box",
          background: inEditMode
            ? `linear-gradient(-45deg, ${onColor} 50%,${offColor} 50%)`
            : bitOn
              ? onColor
              : offColor,
          borderStyle: p.borderStyle?.value,
          borderWidth: p.borderWidth?.value,
          borderColor: p.borderColor?.value,
        }}
      />
    );
  });

  return (
    <AlarmBorder alarmData={pvData?.alarm} enable={p.alarmBorder?.value}>
      <div
        title={p.tooltip?.value ?? ""}
        style={{
          width: p.width?.value,
          height: p.height?.value,
          display: "flex",
          gap: p.spacing?.value,
          flexDirection: isHorizontal ? "row" : "column",
          justifyContent: "center",
          boxSizing: "border-box",
          alignItems: "center",
        }}
      >
        {bits}
      </div>
    </AlarmBorder>
  );
};

export { MultiBitIndicatorComp };
