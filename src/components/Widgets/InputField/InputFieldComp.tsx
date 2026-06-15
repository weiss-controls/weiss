// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";
import { useWSActionsContext } from "@src/context/useEpicsWSContext";
import { formatDisplayValue } from "@src/utils/displayFormat";

const InputFieldComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { writePVValue } = useWSActionsContext();
  const { inEditMode } = useUIContext();
  const [inputValue, setInputValue] = useState<string>("");
  const [isFocused, setIsFocused] = useState(false);

  const p = data.editableProperties;
  const runtimePVName = data.runtimePVName;
  const pvData = data.pvData;
  const units =
    p.unitsFromPV?.value && pvData?.display?.units ? pvData.display.units : p.units?.value;
  const displayFormat = p.displayFormat?.value ?? "Default";

  useEffect(() => {
    if (inEditMode) setInputValue("");
  }, [inEditMode]);

  if (!p.visible?.value) return null;

  const handleWrite = (value: number | string) => {
    if (inEditMode || !runtimePVName) return;
    if (p.pvName?.value) {
      writePVValue(runtimePVName, value);
    }
  };

  return (
    <AlarmBorder alarmData={pvData?.alarm} enable={p.alarmBorder?.value}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <input
          title={p.tooltip?.value ?? ""}
          readOnly={inEditMode}
          style={{
            width: "100%",
            height: "100%",
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
            boxSizing: "border-box",
            padding: "4px 8px",
            pointerEvents: inEditMode ? "none" : "auto",
            textAlign: (p.textHAlign?.value ?? "left") as CSSProperties["textAlign"],
            overflow: "hidden",
          }}
          disabled={p.disabled?.value}
          placeholder={inEditMode ? p.pvName?.value : p.label?.value}
          value={
            isFocused
              ? inputValue
              : !inEditMode && pvData?.value !== undefined
                ? formatDisplayValue(pvData.value, displayFormat) + (units ? ` ${units}` : "")
                : inputValue
          }
          onFocus={() => {
            setInputValue(pvData?.value !== undefined ? String(pvData.value) : "");
            setIsFocused(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            setInputValue("");
          }}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleWrite(inputValue);
            }
          }}
        />
      </div>
    </AlarmBorder>
  );
};

export { InputFieldComp };
