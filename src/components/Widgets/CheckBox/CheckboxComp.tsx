// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import type React from "react";
import Checkbox from "@mui/material/Checkbox";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import type { WidgetUpdate } from "@src/types/widgets";
import { FLEX_ALIGN_MAP } from "@src/constants/constants";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { writePVValue } from "@src/services/WSClient/session";
import { useUIStore } from "@src/stores/uiStore";

export function CheckboxComp({ data }: WidgetUpdate) {
  const inEditMode = useUIStore((s) => s.inEditMode);
  const p = data.editableProperties;
  const runtimePVName = data.runtimePVName;
  const pvData = data.pvData;
  const value = pvData?.value;
  const validValue = typeof value === "number";
  const checked = validValue && value !== 0;
  const label = p.label?.value ?? "";
  const disabled = p.disabled?.value;
  const hAlign = p.textHAlign?.value ?? "left";
  const vAlign = p.textVAlign?.value ?? "middle";
  const placement = p.labelPlcmnt?.value ?? "end";
  const vertical = placement === "top" || placement === "bottom";
  const labelFirst = placement === "start" || placement === "top";
  const invalidRuntime = !inEditMode && !!runtimePVName && !validValue;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (inEditMode || !validValue || !runtimePVName) return;
    writePVValue(runtimePVName, Number(event.target.checked));
  };

  // Same icon-to-text ratio as MUI's defaults (24px icon for 16px text).
  const iconProps = { sx: { fontSize: (p.fontSize?.value ?? 14) * 1.5 } };

  const box = (
    <Checkbox
      checked={checked}
      onChange={handleChange}
      disabled={disabled}
      disableRipple={inEditMode || invalidRuntime}
      icon={<CheckBoxOutlineBlankIcon {...iconProps} />}
      checkedIcon={<CheckBoxIcon {...iconProps} />}
      slotProps={{ input: { "aria-label": label } }}
      sx={{
        p: 0,
        borderRadius: 0,
        flex: "0 0 auto",
        alignSelf: "center",
        color: p.checkboxColor?.value,
        "&.Mui-checked": { color: p.checkboxCheckedColor?.value },
      }}
    />
  );

  const text = label && (
    <span
      style={{
        flex: "0 0 auto",
        maxWidth: "100%",
        alignSelf: FLEX_ALIGN_MAP[vertical ? hAlign : vAlign],
        fontSize: p.fontSize?.value,
        fontFamily: p.fontFamily?.value,
        fontWeight: p.fontBold?.value ? "bold" : "normal",
        fontStyle: p.fontItalic?.value ? "italic" : "normal",
        textDecoration: p.fontUnderlined?.value ? "underline" : "none",
        color: p.textColor?.value,
        opacity: disabled ? 0.5 : 1,
        lineHeight: "normal",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {label}
    </span>
  );

  return (
    <AlarmBorder alarmData={pvData?.alarm} enable={p.alarmBorder?.value}>
      <label
        title={
          invalidRuntime ? "Cannot write PV: invalid type or UDF state" : (p.tooltip?.value ?? "")
        }
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: vertical ? "column" : "row",
          justifyContent: FLEX_ALIGN_MAP[vertical ? vAlign : hAlign],
          alignItems: "stretch",
          gap: label ? 4 : 0,
          backgroundColor: p.backgroundColor?.value,
          borderRadius: p.borderRadius?.value,
          borderStyle: p.borderStyle?.value,
          borderWidth: p.borderWidth?.value,
          borderColor: p.borderColor?.value,
          overflow: "hidden",
          cursor: disabled ? "default" : "pointer",
          pointerEvents: inEditMode ? "none" : "auto",
        }}
      >
        {labelFirst && text}
        {box}
        {!labelFirst && text}
      </label>
    </AlarmBorder>
  );
}
