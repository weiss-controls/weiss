// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import type { WidgetUpdate } from "@src/types/widgets";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";

const BitIndicatorComp: React.FC<WidgetUpdate> = ({ data }) => {
  const p = data.editableProperties;
  const pvData = data.pvData;
  const { inEditMode } = useUIContext();

  if (!p.visible?.value) return null;

  const onColor = p.onColor?.value;
  const offColor = p.offColor?.value;
  const value = pvData?.value ?? 0;
  const bitOn = value === 1;
  const validValue = value === 1 || value === 0;

  const useStr = p.useStringVal?.value;
  const enumOption = validValue && pvData?.enumChoices ? pvData?.enumChoices[value] : "";
  const pvText = useStr ? (enumOption ?? "") : ((value as string) ?? "");

  const labelFromPV = p.labelFromPV?.value;
  const offLabel = p.offLabel?.value ?? "";
  const onLabel = p.onLabel?.value ?? "";

  let renderedText = "";
  if (inEditMode) {
    renderedText = labelFromPV ? `PV ${useStr ? "Label" : "Value"}` : offLabel;
  } else {
    renderedText = labelFromPV ? pvText : bitOn ? onLabel : offLabel;
  }

  const background = inEditMode
    ? `linear-gradient(-45deg, ${onColor} 50%, ${offColor} 50%)`
    : bitOn
      ? onColor
      : offColor;

  const containerWidth = p.width!.value;
  const containerHeight = p.height!.value;
  const circleSize = Math.min(containerWidth, containerHeight);

  const containerStyle: React.CSSProperties = {
    width: containerWidth,
    height: containerHeight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxSizing: "border-box",
    position: "relative",
  };

  const circleStyle: React.CSSProperties = {
    width: p.square?.value ? containerWidth : circleSize,
    height: p.square?.value ? containerHeight : circleSize,
    borderRadius: p.square?.value ? 0 : "50%",
    background,
    borderStyle: p.borderStyle?.value,
    borderWidth: p.borderWidth?.value,
    borderColor: p.borderColor?.value,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    fontSize: p.fontSize?.value,
    fontFamily: p.fontFamily?.value,
    fontWeight: p.fontBold?.value ? "bold" : "normal",
    fontStyle: p.fontItalic?.value ? "italic" : "normal",
    textDecoration: p.fontUnderlined?.value ? "underline" : "none",
    textAlign: "center",
    overflow: "hidden",
  };

  return (
    <AlarmBorder alarmData={pvData?.alarm} enable={p.alarmBorder?.value}>
      <div style={containerStyle} title={p.tooltip?.value ?? ""}>
        <div style={circleStyle}>
          {<span style={{ whiteSpace: "nowrap" }}>{renderedText}</span>}
        </div>
      </div>
    </AlarmBorder>
  );
};

export { BitIndicatorComp };
