// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import { Slider } from "@mui/material";
import type { WidgetUpdate } from "@src/types/widgets";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { useWSActionsContext } from "@src/context/useEpicsWSContext";
import { useUIContext } from "@src/context/useUIContext";

const SliderComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { writePVValue } = useWSActionsContext();
  const { inEditMode } = useUIContext();
  const p = data.editableProperties;
  const pvData = data.pvData;
  if (!p.visible?.value) return null;

  const runtimeMin = (p.limitsFromPV?.value ? pvData?.display?.limitLow : p.min?.value) ?? 0;
  const runtimeMax = (p.limitsFromPV?.value ? pvData?.display?.limitHigh : p.max?.value) ?? 1;
  const min = inEditMode ? 0 : runtimeMin;
  const max = inEditMode ? 1 : runtimeMax;
  const runtimeVal = typeof pvData?.value === "number" ? pvData.value : min;
  const step = p.stepSize?.value && p.stepSize?.value > max - min ? p.stepSize?.value : undefined;
  const value = inEditMode ? 0 : runtimeVal;
  const isHorizontal = p.horizontal?.value ?? true;
  const orientation = isHorizontal ? "horizontal" : "vertical";

  const handleChange = (_: Event | React.SyntheticEvent<Element, Event>, newValue: number) => {
    if (!inEditMode && p.pvName?.value && typeof newValue === "number") {
      writePVValue(p.pvName.value, newValue);
    }
  };

  return (
    <AlarmBorder alarmData={pvData?.alarm} enable={p.alarmBorder?.value}>
      <div
        title={p.tooltip?.value ?? ""}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          boxSizing: "border-box",
          borderRadius: p.borderRadius?.value,
          borderStyle: p.borderStyle?.value,
          borderWidth: p.borderWidth?.value,
          borderColor: p.borderColor?.value,
          pointerEvents: inEditMode ? "none" : "auto",
          padding: isHorizontal ? "0 10px" : "10px 0",
          minHeight: "14px",
        }}
      >
        <Slider
          orientation={orientation}
          min={min}
          max={max}
          value={value}
          step={step}
          marks={step !== undefined}
          disabled={p.disabled?.value}
          onChange={handleChange}
          sx={{
            color: p.backgroundColor?.value ?? "primary.main",
            width: isHorizontal ? "100%" : undefined,
            height: !isHorizontal ? "100%" : undefined,
            pointerEvents: inEditMode ? "none" : "auto",
            flexShrink: 0,
          }}
        />
      </div>
    </AlarmBorder>
  );
};
export { SliderComp };
