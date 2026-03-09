// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { EmbeddedDisplayComp } from "./EmbeddedDisplayComp.tsx";
import { PROPERTY_SCHEMAS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import ScreenshotMonitorIcon from "@mui/icons-material/ScreenshotMonitor";

export const EmbeddedDisplay: WidgetDefinition = {
  component: EmbeddedDisplayComp,
  widgetName: "EmbeddedDisplay",
  widgetIcon: ScreenshotMonitorIcon,
  widgetLabel: "Embedded Display",
  category: "Basic",
  defaultProperties: {
    x: PROPERTY_SCHEMAS.x,
    y: PROPERTY_SCHEMAS.y,
    tooltip: PROPERTY_SCHEMAS.tooltip,
    width: { ...PROPERTY_SCHEMAS.width, value: 300 },
    height: { ...PROPERTY_SCHEMAS.height, value: 210 },
    displayPath: PROPERTY_SCHEMAS.displayPath,
  },
};
