// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import { FormControl, InputLabel, MenuItem, Select, type SelectChangeEvent } from "@mui/material";
import type { WidgetUpdate } from "@src/types/widgets";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { useWSActionsContext } from "@src/context/useEpicsWSContext";
import { useUIContext } from "@src/context/useUIContext";

const SelectionBoxComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { writePVValue } = useWSActionsContext();
  const { inEditMode } = useUIContext();
  const p = data.editableProperties;
  const pvData = data.pvData;

  if (!p.visible?.value) return null;

  const enumChoices: string[] =
    (p.labelFromPV?.value ? pvData?.enumChoices : p.enumChoices?.value) ?? [];

  // Compute current index based on PV value or default to 0
  const currentIndex =
    typeof pvData?.value === "number" && pvData.value >= 0 && pvData.value < enumChoices.length
      ? pvData.value
      : "";

  const handleChange = (e: SelectChangeEvent<string>) => {
    const newIndex = parseInt(e.target.value);
    if (!inEditMode && p.pvName?.value) {
      writePVValue(p.pvName.value, newIndex);
    }
  };

  const commonConfig = {
    width: "100%",
    height: "100%",
    color: p.textColor?.value,
    fontSize: p.fontSize?.value,
    fontFamily: p.fontFamily?.value,
    fontWeight: p.fontBold?.value ? "bold" : "normal",
    fontStyle: p.fontItalic?.value ? "italic" : "normal",
    textDecoration: p.fontUnderlined?.value ? "underline" : "none",
  };

  return (
    <AlarmBorder alarmData={pvData?.alarm} enable={p.alarmBorder?.value}>
      <FormControl
        fullWidth
        sx={{
          ...commonConfig,
          display: "flex",
          backgroundColor: p.backgroundColor?.value,
          borderRadius: p.borderRadius?.value,
          borderStyle: p.borderStyle?.value,
          borderWidth: p.borderWidth?.value,
          borderColor: p.borderColor?.value,
        }}
      >
        <InputLabel sx={commonConfig}>{p.label?.value}</InputLabel>
        <Select
          value={String(currentIndex)}
          disabled={p.disabled?.value}
          label={p.label?.value}
          onChange={handleChange}
          size="small"
          sx={{
            ...commonConfig,
            backgroundColor: p.backgroundColor?.value,
            pointerEvents: inEditMode ? "none" : "auto",
          }}
        >
          {enumChoices.map((choice, idx) => (
            <MenuItem key={idx} sx={commonConfig} value={String(idx)}>
              {choice}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </AlarmBorder>
  );
};

export { SelectionBoxComp };
