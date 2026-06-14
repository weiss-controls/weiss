// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import { FLEX_ALIGN_MAP } from "@src/constants/constants";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";
import { formatDisplayValue } from "@src/utils/displayFormat";

const TextUpdateComp: React.FC<WidgetUpdate> = ({ data }) => {
  const p = data.editableProperties;
  const pvData = data.pvData;
  const { inEditMode } = useUIContext();

  if (!p.visible?.value) return null;

  const units = p.unitsFromPV?.value ? pvData?.display?.units : p.units?.value;
  const precision = p.precisionFromPV?.value ? pvData?.display?.precision : p.precision?.value;
  const displayFormat = p.displayFormat?.value ?? "Default";

  let displayValue: string;

  if (inEditMode) {
    displayValue = p.pvName?.value ?? p.label?.value ?? "";
  } else {
    const val = pvData?.value;
    if (val === undefined || val === null) {
      displayValue = "";
    } else if (
      typeof val === "number" &&
      pvData?.enumChoices?.length &&
      (displayFormat === "Default" || displayFormat === "String")
    ) {
      const label = val < pvData.enumChoices.length ? pvData.enumChoices[val] : undefined;
      displayValue = label ?? formatDisplayValue(val, displayFormat, precision);
    } else {
      displayValue = formatDisplayValue(val, displayFormat, precision);
    }
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
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textAlign: (p.textHAlign?.value ??
              "left") as unknown as React.CSSProperties["textAlign"],
          }}
        >
          {displayValue}
          {units && <span style={{ marginLeft: 4 }}>{units}</span>}
        </span>
      </div>
    </AlarmBorder>
  );
};

export { TextUpdateComp };
