// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import type { WidgetUpdate } from "@src/types/widgets";
import { COLORS, FLEX_ALIGN_MAP } from "@src/constants/constants";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { writePVValue } from "@src/services/WSClient/session";
import { useUIStore } from "@src/stores/uiStore";

const EDIT_PV_CHOICES = ["PV option 1", "PV option 2"];

export function ChoiceButtonComp({ data }: WidgetUpdate) {
  const inEditMode = useUIStore((s) => s.inEditMode);
  const p = data.editableProperties;
  const runtimePVName = data.runtimePVName;
  const pvData = data.pvData;
  const value = pvData?.value;
  const labelFromPV = p.labelFromPV?.value;
  const disabled = p.disabled?.value;

  let choices: string[];
  if (!labelFromPV) choices = p.enumChoices?.value ?? [];
  else if (inEditMode) choices = EDIT_PV_CHOICES;
  else choices = pvData?.enumChoices ?? [];

  const selectedIdx = typeof value === "number" ? value : -1;

  const handleClick = (idx: number) => {
    if (inEditMode || !runtimePVName || idx === selectedIdx) return;
    writePVValue(runtimePVName, idx);
  };

  return (
    <AlarmBorder alarmData={pvData?.alarm} enable={p.alarmBorder?.value}>
      <ButtonGroup
        title={p.tooltip?.value ?? ""}
        orientation={p.horizontal?.value ? "horizontal" : "vertical"}
        variant="contained"
        disableElevation
        disabled={disabled}
        sx={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          backgroundColor: p.backgroundColor?.value,
          borderRadius: `${p.borderRadius?.value}px`,
          borderStyle: p.borderStyle?.value,
          borderWidth: p.borderWidth?.value,
          borderColor: p.borderColor?.value,
          overflow: "hidden",
          pointerEvents: inEditMode ? "none" : "auto",
          "& .MuiButtonGroup-grouped": { borderColor: `${COLORS.midGray} !important` },
        }}
      >
        {choices.map((choice, idx) => {
          const bgColor = idx === selectedIdx ? p.selectedColor?.value : p.unselectedColor?.value;
          return (
            <Button
              key={idx}
              aria-pressed={idx === selectedIdx}
              disableRipple={inEditMode}
              onClick={() => handleClick(idx)}
              sx={{
                flex: "1 1 0",
                minWidth: 0,
                minHeight: 0,
                padding: 0.5,
                display: "flex",
                justifyContent: FLEX_ALIGN_MAP[p.textHAlign?.value ?? "center"],
                alignItems: FLEX_ALIGN_MAP[p.textVAlign?.value ?? "middle"],
                textTransform: "none",
                backgroundColor: bgColor,
                "&:hover": { backgroundColor: bgColor, filter: "brightness(0.92)" },
                color: p.textColor?.value,
                fontSize: p.fontSize?.value,
                fontFamily: p.fontFamily?.value,
                fontWeight: p.fontBold?.value ? "bold" : "normal",
                fontStyle: p.fontItalic?.value ? "italic" : "normal",
                textDecoration: p.fontUnderlined?.value ? "underline" : "none",
                lineHeight: "normal",
                "&.Mui-disabled": { color: p.textColor?.value, opacity: 0.5 },
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {choice}
              </span>
            </Button>
          );
        })}
      </ButtonGroup>
    </AlarmBorder>
  );
}
