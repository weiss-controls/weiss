// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import type React from "react";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import type { WidgetUpdate } from "@src/types/widgets";
import { FLEX_ALIGN_MAP } from "@src/constants/constants";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { writePVValue } from "@src/services/WSClient/session";
import { useUIStore } from "@src/stores/uiStore";

const EDIT_PV_CHOICES = ["PV option 1", "PV option 2"];

export function RadioButtonComp({ data }: WidgetUpdate) {
  const inEditMode = useUIStore((s) => s.inEditMode);
  const p = data.editableProperties;
  const runtimePVName = data.runtimePVName;
  const pvData = data.pvData;
  const value = pvData?.value;
  const labelFromPV = p.labelFromPV?.value;
  const fontSize = p.fontSize?.value ?? 14;
  const horizontal = p.horizontal?.value;

  let choices: string[];
  if (!labelFromPV) choices = p.enumChoices?.value ?? [];
  else if (inEditMode) choices = EDIT_PV_CHOICES;
  else choices = pvData?.enumChoices ?? [];

  const validValue = typeof value === "number" && value >= 0 && value < choices.length;
  const selected = validValue ? String(value) : "";

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (inEditMode || !runtimePVName) return;
    writePVValue(runtimePVName, Number(event.target.value));
  };

  return (
    <AlarmBorder alarmData={pvData?.alarm} enable={p.alarmBorder?.value}>
      <div
        title={p.tooltip?.value ?? ""}
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          justifyContent: FLEX_ALIGN_MAP[p.textHAlign?.value ?? "left"],
          alignItems: FLEX_ALIGN_MAP[p.textVAlign?.value ?? "middle"],
          backgroundColor: p.backgroundColor?.value,
          borderRadius: p.borderRadius?.value,
          borderStyle: p.borderStyle?.value,
          borderWidth: p.borderWidth?.value,
          borderColor: p.borderColor?.value,
          overflow: "visible",
          pointerEvents: inEditMode ? "none" : "auto",
        }}
      >
        <RadioGroup
          row={horizontal}
          value={selected}
          onChange={handleChange}
          sx={{
            flexWrap: "nowrap",
            flexShrink: 0,
            gap: horizontal ? `0 ${fontSize}px` : `${fontSize * 0.25}px 0`,
          }}
        >
          {choices.map((choice, idx) => (
            <FormControlLabel
              key={idx}
              value={String(idx)}
              label={choice}
              labelPlacement={p.labelPlcmnt?.value as "end" | "start" | "top" | "bottom"}
              disabled={p.disabled?.value}
              sx={{
                m: 0,
                gap: `${fontSize * 0.25}px`,
                "& .MuiFormControlLabel-label": {
                  fontSize,
                  fontFamily: p.fontFamily?.value,
                  fontWeight: p.fontBold?.value ? "bold" : "normal",
                  fontStyle: p.fontItalic?.value ? "italic" : "normal",
                  textDecoration: p.fontUnderlined?.value ? "underline" : "none",
                  color: p.textColor?.value,
                  lineHeight: "normal",
                  whiteSpace: "nowrap",
                },
              }}
              control={
                <Radio
                  disableRipple={inEditMode}
                  sx={{
                    p: 0,
                    color: p.radioColor?.value,
                    "&.Mui-checked": { color: p.radioCheckedColor?.value },
                    // Same icon-to-text ratio as MUI's defaults (24px icon for 16px text).
                    "& .MuiSvgIcon-root": { fontSize: fontSize * 1.5 },
                  }}
                />
              }
            />
          ))}
        </RadioGroup>
      </div>
    </AlarmBorder>
  );
}
