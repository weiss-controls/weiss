// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import { Button } from "@mui/material";
import type { WidgetUpdate } from "@src/types/widgets";
import { FLEX_ALIGN_MAP } from "@src/constants/constants";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";
import { useEpicsWSContext } from "@src/context/useEpicsWSContext";

const ActionButtonComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { writePVValue } = useEpicsWSContext();
  const { inEditMode } = useUIContext();
  const p = data.editableProperties;
  const pvData = data.pvData;

  const handleClick = (_e: React.MouseEvent) => {
    if (!inEditMode) {
      if (p.pvName?.value && p.actionValue?.value !== undefined) {
        const actionValue = p.actionValue.value;
        // convert to number if is number as string
        const value =
          typeof actionValue === "string" && !isNaN(Number(actionValue))
            ? Number(actionValue)
            : actionValue;
        writePVValue(p.pvName.value, value);
      }
    }
  };

  if (!p.visible?.value) return null;

  return (
    <AlarmBorder alarmData={pvData?.alarm} enable={p.alarmBorder?.value}>
      <Button
        title={p.tooltip?.value ?? ""}
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
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
          textTransform: "none",
          pointerEvents: inEditMode ? "none" : "auto",
          overflow: "hidden",
        }}
        disableElevation
        disableRipple={inEditMode}
        disabled={p.disabled!.value}
        variant="contained"
        onClick={(e) => handleClick(e)}
      >
        {p.label!.value}
      </Button>
    </AlarmBorder>
  );
};

export { ActionButtonComp };
