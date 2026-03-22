// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import { Button } from "@mui/material";
import type { WidgetUpdate } from "@src/types/widgets";
import { FLEX_ALIGN_MAP } from "@src/constants/constants";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { useEpicsWSContext } from "@src/context/useEpicsWSContext";
import { useUIContext } from "@src/context/useUIContext";

const ToggleButtonComp: React.FC<WidgetUpdate> = ({ data }) => {
  const { writePVValue } = useEpicsWSContext();
  const { inEditMode } = useUIContext();
  const p = data.editableProperties;
  const pvData = data.pvData;
  const value = pvData?.value;
  const validValue = value === 1 || value === 0;
  const bitOn = value === 1;
  const enumOption = validValue && pvData?.enumChoices ? pvData?.enumChoices[value] : "";
  const useStr = p.useStringVal?.value;

  const onColor = p.onColor?.value;
  const offColor = p.offColor?.value;
  const bitColor = bitOn ? onColor : offColor;

  const runtimeText = useStr ? (enumOption ?? "") : ((value as string) ?? "");
  const labelFromPV = p.labelFromPV?.value;
  const offLabel = p.offLabel?.value ?? "";
  const onLabel = p.onLabel?.value ?? "";

  let text = "";
  if (inEditMode) {
    text = labelFromPV ? `PV ${useStr ? "Label" : "Value"}` : offLabel;
  } else {
    text = labelFromPV ? runtimeText : bitOn ? onLabel : offLabel;
  }

  const handleClick = (_e: React.MouseEvent) => {
    if (!inEditMode && validValue && p.pvName?.value) {
      writePVValue(p.pvName.value, Number(!value));
    }
  };

  if (!p.visible?.value) return null;

  // Pattern or solid fill for the circle
  const circleBackground = inEditMode
    ? `linear-gradient(-45deg, ${onColor} 50%, ${offColor} 50%)`
    : bitColor;

  const circleStyle: React.CSSProperties = {
    width: Math.min(p.width!.value, p.height!.value) * 0.3,
    height: Math.min(p.width!.value, p.height!.value) * 0.3,
    borderRadius: "50%",
    background: circleBackground,
    outline: "1px solid rgba(0,0,0,0.3)",
    flexShrink: 0,
    marginRight: 8,
    overflow: "hidden",
  };

  return (
    <AlarmBorder alarmData={pvData?.alarm} enable={p.alarmBorder?.value}>
      <Button
        title={
          !validValue ? "Cannot toggle PV: invalid type or UDF state" : (p.tooltip?.value ?? "")
        }
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
          minWidth: 0,
          minHeight: 0,
          padding: 0,
          overflow: "hidden",
        }}
        disableRipple={inEditMode || !validValue}
        disabled={p.disabled?.value}
        variant="contained"
        onClick={handleClick}
      >
        <div style={circleStyle} />
        {text}
      </Button>
    </AlarmBorder>
  );
};

export { ToggleButtonComp };
