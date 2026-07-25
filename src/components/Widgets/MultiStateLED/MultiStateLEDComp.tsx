// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import type { StateEntry, WidgetUpdate } from "@src/types/widgets";
import AlarmBorder from "@components/AlarmBorder/AlarmBorder";
import { useUIContext } from "@src/context/useUIContext";

function matchState(pvValue: unknown, states: StateEntry[]): number {
  const numericPV = parseFloat(String(pvValue));
  for (let i = 0; i < states.length; i++) {
    const numericState = parseFloat(states[i].value);
    if (isFinite(numericPV) && isFinite(numericState)) {
      if (numericPV === numericState) return i;
    } else {
      if (String(pvValue) === states[i].value) return i;
    }
  }
  return -1;
}

const MultiStateLEDComp: React.FC<WidgetUpdate> = ({ data }) => {
  const p = data.editableProperties;
  const pvData = data.pvData;
  const { inEditMode } = useUIContext();

  if (!p.visible?.value) return null;

  const states = p.stateList?.value ?? [];
  // Last entry is always the fallback state
  const normalStates = states.slice(0, -1);
  const fallbackState = states[states.length - 1] ?? {
    value: "",
    color: "rgba(128,128,128,1)",
    label: "",
  };
  const labelFromPV = p.labelFromPV!.value;

  const pvValue = pvData?.value ?? 0;
  const matchedIndex = inEditMode ? -1 : matchState(pvValue, normalStates);

  // Active color
  let activeColor: string;
  if (inEditMode) {
    activeColor = fallbackState.color; // overridden below by edit-mode segments
  } else if (matchedIndex >= 0) {
    activeColor = normalStates[matchedIndex].color;
  } else {
    activeColor = fallbackState.color;
  }

  // Active label
  let renderedText: string;
  if (inEditMode) {
    renderedText = labelFromPV ? "PV Value" : (normalStates[0]?.label ?? "");
  } else if (labelFromPV) {
    const numericPV = parseFloat(String(pvValue));
    renderedText = pvData?.enumChoices?.[isFinite(numericPV) ? numericPV : -1] ?? String(pvValue);
  } else if (matchedIndex >= 0) {
    renderedText = normalStates[matchedIndex].label;
  } else {
    renderedText = fallbackState.label;
  }

  const containerWidth = p.width!.value;
  const containerHeight = p.height!.value;
  const isSquare = p.square!.value;
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

  const shapeBase: React.CSSProperties = {
    width: isSquare ? containerWidth : circleSize,
    height: isSquare ? containerHeight : circleSize,
    borderRadius: isSquare ? 0 : "50%",
    borderStyle: p.borderStyle!.value,
    borderWidth: p.borderWidth!.value,
    borderColor: p.borderColor!.value,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    fontSize: p.fontSize!.value,
    fontFamily: p.fontFamily!.value,
    fontWeight: p.fontBold!.value ? "bold" : "normal",
    fontStyle: p.fontItalic!.value ? "italic" : "normal",
    textDecoration: p.fontUnderlined!.value ? "underline" : "none",
    textAlign: "center",
    overflow: "hidden",
    color: p.textColor!.value,
    position: "relative",
  };

  // In edit mode render N equal-width color segments side by side inside the LED shape
  const editSegments = normalStates.length > 0 ? normalStates : [fallbackState];
  const innerContent =
    inEditMode && editSegments.length > 1 ? (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          borderRadius: "inherit",
          overflow: "hidden",
        }}
      >
        {editSegments.map((s, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              backgroundColor: s.color,
            }}
          />
        ))}
      </div>
    ) : (
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor:
            inEditMode && editSegments.length === 1 ? editSegments[0].color : activeColor,
          borderRadius: "inherit",
        }}
      />
    );

  return (
    <AlarmBorder alarmData={pvData?.alarm} enable={p.alarmBorder!.value}>
      <div style={containerStyle} title={p.tooltip!.value}>
        <div style={shapeBase}>
          {innerContent}
          <span
            style={{ whiteSpace: "nowrap", position: "relative", zIndex: 1, paddingLeft: "5px" }}
          >
            {renderedText}
          </span>
        </div>
      </div>
    </AlarmBorder>
  );
};

export { MultiStateLEDComp };
