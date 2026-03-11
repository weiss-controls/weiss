// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import { FLEX_ALIGN_MAP } from "@src/constants/constants";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";

const TextUpdateComp: React.FC<WidgetUpdate> = ({ data }) => {
  const p = data.editableProperties;
  const pvData = data.pvData;
  const { inEditMode } = useUIContext();

  if (!p.visible?.value) return null;

  const units = p.unitsFromPV?.value ? pvData?.display?.units : p.units?.value;
  const precision = p.precisionFromPV?.value ? pvData?.display?.precision : p.precision?.value;

  let displayValue = pvData?.value;

  if (!inEditMode && typeof pvData?.value === "number") {
    const val = pvData.value;
    if (typeof precision === "number" && precision > 0 && !pvData.enumChoices) {
      displayValue = val.toFixed(precision);
    } else if (pvData.enumChoices && pvData.enumChoices.length > 0) {
      const validIdx = val <= pvData.enumChoices.length;
      displayValue = validIdx ? pvData.enumChoices[val] : val;
    }
  } else if (inEditMode) {
    displayValue = p.pvName?.value ?? p.label?.value ?? "";
  }

  return (
    <AlarmBorder alarmData={pvData?.alarm} enable={p.alarmBorder?.value ?? true}>
      <div
        title={p.tooltip?.value ?? ""}
        className="textUpdate"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          paddingLeft: 5,
          paddingRight: 5,
          boxSizing: "border-box",
          overflow: "hidden",
          justifyContent: FLEX_ALIGN_MAP[p.textHAlign?.value ?? "left"],
          alignItems: FLEX_ALIGN_MAP[p.textVAlign?.value ?? "middle"],
          backgroundColor: p.backgroundColor?.value,
          fontSize: p.fontSize?.value,
          fontFamily: p.fontFamily?.value,
          fontWeight: p.fontBold?.value ? "bold" : "normal",
          fontStyle: p.fontItalic?.value ? "italic" : "normal",
          textDecoration: p.fontUnderlined?.value ? "underline" : "none",
          color: p.textColor?.value,
          borderRadius: p.borderRadius?.value,
          borderStyle: p.borderStyle?.value,
          borderWidth: p.borderWidth?.value,
          borderColor: p.borderColor?.value,
        }}
      >
        {displayValue}
        {units && (
          <span
            style={{
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              color: p.textColor?.value,
              fontSize: p.fontSize?.value,
              pointerEvents: "none",
            }}
          >
            {units}
          </span>
        )}
      </div>
    </AlarmBorder>
  );
};

export { TextUpdateComp };
