// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import React from "react";
import type { ReactNode, CSSProperties } from "react";
import type { Alarm } from "@src/types/epicsWS";
import { COLORS } from "@src/constants/constants";
import { useUIContext } from "@src/context/useUIContext";

interface AlarmBorderProps {
  alarmData?: Alarm | Alarm[];
  children: ReactNode;
  enable: boolean | undefined;
}

const AlarmBorder: React.FC<AlarmBorderProps> = ({ alarmData, children, enable }) => {
  const { inEditMode } = useUIContext();

  const getWorstSeverity = (a: Alarm | Alarm[] | undefined): number | undefined => {
    if (!a) return undefined;
    return Array.isArray(a) ? Math.max(...a.map((x) => x?.severity ?? 0)) : a.severity;
  };

  const getOutlineColor = (severity: number | undefined): string | undefined => {
    switch (severity) {
      case 0: // NO_ALARM
        return undefined;
      case 1: // MINOR
        return COLORS.minor;
      case 2: // MAJOR
        return COLORS.major;
      case 3: // INVALID
        return COLORS.invalid;
      default: // disconnected or undefined
        return COLORS.disconnected;
    }
  };

  const getOutlineStyle = (severity: number | undefined) => {
    switch (severity) {
      case 3: // INVALID
        return "dashed";
      case undefined:
        return "dotted";
      default:
        return "solid";
    }
  };

  const severity = getWorstSeverity(alarmData);
  const outlineColor = getOutlineColor(severity);
  const outlineStyle = getOutlineStyle(severity);

  const style: CSSProperties = {
    width: "100%",
    height: "100%",
    outlineColor: outlineColor,
    outlineWidth: outlineColor ? "3px" : 0,
    outlineStyle: outlineStyle,
    borderRadius: "2px",
    boxSizing: "border-box",
  };

  return enable && !inEditMode ? <div style={style}>{children}</div> : children;
};

export default AlarmBorder;
