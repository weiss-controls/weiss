// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import { Box } from "@mui/material";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { FLEX_ALIGN_MAP } from "@src/constants/constants";
import type { WidgetUpdate } from "@src/types/widgets";

export const ProgressBarComp: React.FC<WidgetUpdate> = ({ data }) => {
  const p = data.editableProperties;
  const pvData = data.pvData;

  // Extract editable properties
  const showValue = p.showValue!.value;
  const valuePlcmnt = p.valuePlcmnt!.value;
  const showPercentage = p.showPercentage!.value;
  const horizontal = p.horizontal!.value;
  const barColor = p.barColor!.value;
  const fontSize = p.fontSize!.value;
  const textColor = p.textColor!.value;
  const fontBold = p.fontBold!.value;
  const fontItalic = p.fontItalic!.value;
  const fontUnderlined = p.fontUnderlined!.value;
  const fontFamily = p.fontFamily!.value;
  const textHAlign = p.textHAlign!.value;
  const textVAlign = p.textVAlign!.value;
  const limitsFromPV = p.limitsFromPV!.value;
  const backgroundColor = p.backgroundColor!.value;

  // Determine limits
  let minValue = p.min?.value ?? 0;
  let maxValue = p.max?.value ?? 100;

  if (limitsFromPV && pvData?.display) {
    if (pvData.display.limitLow !== undefined) {
      minValue = pvData.display.limitLow;
    }
    if (pvData.display.limitHigh !== undefined) {
      maxValue = pvData.display.limitHigh;
    }
  }

  // Get current value and format it
  const currentValue = (pvData?.value as number) ?? 0;

  // Calculate progress percentage (0-100)
  const range = maxValue - minValue;
  let progress = 0;
  if (range > 0) {
    progress = ((currentValue - minValue) / range) * 100;
  }
  // Clamp to 0-100
  progress = Math.max(0, Math.min(100, progress));

  // Format display value based on showPercentage
  let displayValue: string;
  if (showPercentage) {
    displayValue = `${progress.toFixed(1)}%`;
  } else {
    // Show raw value with precision if available
    if (typeof currentValue === "number") {
      const precision = pvData?.display?.precision;
      if (typeof precision === "number" && precision >= 0) {
        displayValue = currentValue.toFixed(precision);
      } else {
        // Default: 1 decimal place
        displayValue = currentValue.toFixed(1);
      }
    } else {
      displayValue = String(currentValue);
    }
  }

  // Text styling
  const textDecoration = fontUnderlined ? "underline" : "none";
  const fontWeight = fontBold ? "bold" : "normal";
  const fontStyle = fontItalic ? "italic" : "normal";

  const textStyleObj = {
    fontSize: `${fontSize}px`,
    color: textColor,
    fontWeight: fontWeight,
    fontStyle: fontStyle,
    textDecoration: textDecoration,
    fontFamily: fontFamily,
    textAlign: textHAlign as "left" | "center" | "right",
  };

  // Alignment for inline display
  const justifyContent = FLEX_ALIGN_MAP[textHAlign] ?? "center";
  const alignItems = FLEX_ALIGN_MAP[textVAlign] ?? "center";

  // Determine layout based on horizontal prop
  const showInline = valuePlcmnt === "middle";
  // top/bottom: stack value and bar vertically; start/end: side by side
  const isColumnContainer = valuePlcmnt === "top" || valuePlcmnt === "bottom";
  const containerFlexDirection = isColumnContainer ? "column" : "row";
  // top/start: value before bar; bottom/end: value after bar
  const valueBefore = valuePlcmnt === "top" || valuePlcmnt === "start";
  const externalAlignSelf = isColumnContainer ? justifyContent : alignItems;

  return (
    <AlarmBorder alarmData={pvData?.alarm} enable={p.alarmBorder?.value}>
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: containerFlexDirection,
          justifyContent: "center",
          padding: "4px",
          boxSizing: "border-box",
          gap: "4px",
        }}
      >
        {!showInline && valueBefore && showValue && (
          <Box
            sx={{
              ...textStyleObj,
              display: "flex",
              justifyContent: justifyContent,
              alignItems: alignItems,
              alignSelf: externalAlignSelf,
            }}
          >
            {displayValue}
          </Box>
        )}

        <Box
          sx={{
            position: "relative",
            flex: 1,
            overflow: "hidden",
            borderRadius: "4px",
            backgroundColor: backgroundColor,
          }}
        >
          {/* Fill bar: grows from left (horizontal) or bottom (vertical) */}
          <Box
            sx={{
              position: "absolute",
              left: 0,
              bottom: 0,
              width: horizontal ? `${progress}%` : "100%",
              height: horizontal ? "100%" : `${progress}%`,
              backgroundColor: barColor || "primary.main",
            }}
          />
          {showInline && showValue && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                justifyContent: justifyContent,
                alignItems: alignItems,
                paddingX: "4px",
                ...textStyleObj,
                zIndex: 1,
              }}
            >
              {displayValue}
            </Box>
          )}
        </Box>
        {!showInline && !valueBefore && showValue && (
          <Box
            sx={{
              ...textStyleObj,
              display: "flex",
              justifyContent: justifyContent,
              alignItems: alignItems,
              alignSelf: externalAlignSelf,
            }}
          >
            {displayValue}
          </Box>
        )}
      </Box>
    </AlarmBorder>
  );
};
