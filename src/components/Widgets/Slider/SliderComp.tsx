// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useEffect, useRef, useState } from "react";
import { Slider } from "@mui/material";
import type { WidgetUpdate } from "@src/types/widgets";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { useWSActionsContext } from "@src/context/useEpicsWSContext";
import { useUIContext } from "@src/context/useUIContext";
import { formatDisplayValue } from "@src/utils/displayFormat";

const SliderComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { writePVValue } = useWSActionsContext();
  const { inEditMode } = useUIContext();
  const p = data.editableProperties;
  const runtimePVName = data.runtimePVName;
  const pvData = data.pvData;

  // Optimistic local state: show drag position immediately without waiting for
  // the IOC round-trip.  Released back to the PV value once the IOC confirms
  // the final written value, ignoring intermediate echoes from a fast drag.
  const [localValue, setLocalValue] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  /** The last value committed on mouse-up; null while dragging or after confirmation. */
  const lastWrittenRef = useRef<number | null>(null);
  /** Safety timeout: release localValue after 2 s if IOC never echoes the exact value. */
  const releaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear localValue once the PV confirms the final written value.
  // Intermediate echoes (value !== lastWrittenRef) are ignored to prevent visual replay.
  useEffect(() => {
    if (isDraggingRef.current) return;
    if (lastWrittenRef.current === null) {
      setLocalValue(null);
      return;
    }
    if (pvData?.value === lastWrittenRef.current) {
      clearTimeout(releaseTimeoutRef.current ?? undefined);
      releaseTimeoutRef.current = null;
      lastWrittenRef.current = null;
      setLocalValue(null);
    }
  }, [pvData?.value]);

  // Clean up safety timeout on unmount.
  useEffect(
    () => () => {
      clearTimeout(releaseTimeoutRef.current ?? undefined);
    },
    [],
  );

  const handleChange = (_: Event | React.SyntheticEvent<Element, Event>, newValue: number) => {
    if (!inEditMode && runtimePVName && typeof newValue === "number") {
      isDraggingRef.current = true;
      setLocalValue(newValue);
      writePVValue(runtimePVName, newValue);
    }
  };

  const handleChangeCommitted = (_: unknown, newValue: number | number[]) => {
    isDraggingRef.current = false;
    const final = typeof newValue === "number" ? newValue : null;
    lastWrittenRef.current = final;
    if (final !== null) {
      // Fallback in case the IOC clamps/rounds and never echoes the exact value.
      clearTimeout(releaseTimeoutRef.current ?? undefined);
      releaseTimeoutRef.current = setTimeout(() => {
        lastWrittenRef.current = null;
        setLocalValue(null);
      }, 2000);
    }
  };

  const isHorizontal = p.horizontal?.value ?? true;
  const orientation = isHorizontal ? "horizontal" : "vertical";
  const displayFormat = p.displayFormat?.value ?? "Default";

  if (!p.visible?.value) return null;

  const runtimeMin = (p.limitsFromPV?.value ? pvData?.display?.limitLow : p.min?.value) ?? 0;
  const runtimeMax = (p.limitsFromPV?.value ? pvData?.display?.limitHigh : p.max?.value) ?? 1;
  const min = inEditMode ? 0 : runtimeMin;
  const max = inEditMode ? 1 : runtimeMax;
  const runtimeVal = typeof pvData?.value === "number" ? pvData.value : min;
  const step = p.stepSize?.value && p.stepSize?.value > max - min ? p.stepSize?.value : undefined;
  const value = inEditMode ? 0 : (localValue ?? runtimeVal);

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
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => formatDisplayValue(v, displayFormat)}
          onChange={handleChange}
          onChangeCommitted={handleChangeCommitted}
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
