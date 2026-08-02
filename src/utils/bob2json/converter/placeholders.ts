// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { COLORS } from "@src/constants/constants";
import { PhoebusProperty } from "../constants";
import type { PhoebusWidget } from "../types";
import type { ExportedWidget } from "@src/types/widgets";
import { getNumericProperty } from "./valueMappers";

/**
 * Builders for fallback widgets used when a Phoebus type is unsupported.
 */

export function buildUnsupportedPlaceholderWidget(
  phWidget: PhoebusWidget,
  xOffset: number,
  yOffset: number,
  forcePositionFromOffset = false,
): ExportedWidget {
  const hasRawX = phWidget.properties.has(PhoebusProperty.X);
  const hasRawY = phWidget.properties.has(PhoebusProperty.Y);
  const x = hasRawX
    ? getNumericProperty(phWidget, PhoebusProperty.X, 100) + xOffset
    : forcePositionFromOffset
      ? xOffset
      : 100 + xOffset;
  const y = hasRawY
    ? getNumericProperty(phWidget, PhoebusProperty.Y, 100) + yOffset
    : forcePositionFromOffset
      ? yOffset
      : 100 + yOffset;
  const width = getNumericProperty(phWidget, PhoebusProperty.WIDTH, 100);
  const height = getNumericProperty(phWidget, PhoebusProperty.HEIGHT, 100);
  const tooltip = `Unsupported Phoebus widget: ${phWidget.type}`;

  return {
    widgetName: "TextLabel",
    properties: {
      x,
      y,
      width,
      height,
      label: "Unsupported Phoebus Widget",
      textHAlign: "center",
      textVAlign: "middle",
      backgroundColor: "transparent",
      borderStyle: "dashed",
      borderWidth: 1,
      fontSize: 12,
      textColor: COLORS.textColor,
      tooltip,
    } as ExportedWidget["properties"],
  };
}
