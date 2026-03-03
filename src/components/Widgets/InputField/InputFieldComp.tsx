// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React, { useState, useEffect } from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";
import { useEpicsWSContext } from "@src/context/useEpicsWSContext";

const InputFieldComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { writePVValue } = useEpicsWSContext();
  const { inEditMode } = useUIContext();
  const [inputValue, setInputValue] = useState<string>("");

  const p = data.editableProperties;
  const pvData = data.pvData;
  const units =
    p.unitsFromPV?.value && pvData?.display?.units ? pvData.display.units : p.units?.value;

  useEffect(() => {
    if (inEditMode) setInputValue("");
  }, [inEditMode]);

  if (!p.visible?.value) return null;

  const handleWrite = (value: number | string) => {
    if (inEditMode) return;
    if (p.pvName?.value) {
      writePVValue(p.pvName.value, value);
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
            margin: "auto",
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
            paddingRight: units ? "2em" : "8px",
            pointerEvents: inEditMode ? "none" : "auto",
          }}
          disabled={p.disabled?.value}
          placeholder={inEditMode ? p.pvName?.value : p.label?.value}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleWrite(inputValue);
            }
          }}
        />
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

export { InputFieldComp };
