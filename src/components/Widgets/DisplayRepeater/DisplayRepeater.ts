// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { DisplayRepeaterComp } from "./DisplayRepeaterComp";
import { PROPERTY_SCHEMAS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import ViewModuleIcon from "@mui/icons-material/ViewModule";

export const DisplayRepeater: WidgetDefinition = {
  component: DisplayRepeaterComp,
  widgetName: "DisplayRepeater",
  widgetIcon: ViewModuleIcon,
  widgetLabel: "Display Repeater",
  category: "Layout",
  defaultProperties: {
    alias: PROPERTY_SCHEMAS.alias,
    x: PROPERTY_SCHEMAS.x,
    y: PROPERTY_SCHEMAS.y,
    width: { ...PROPERTY_SCHEMAS.width, value: 600 },
    height: { ...PROPERTY_SCHEMAS.height, value: 210 },
    tooltip: { ...PROPERTY_SCHEMAS.tooltip, value: "" },
    visible: PROPERTY_SCHEMAS.visible,
    displayPath: PROPERTY_SCHEMAS.displayPath,
    macros: { ...PROPERTY_SCHEMAS.macros, label: "Shared macro" },
    instances: PROPERTY_SCHEMAS.instances,
    horizontal: { ...PROPERTY_SCHEMAS.horizontal, value: true },
    instanceGap: PROPERTY_SCHEMAS.instanceGap,
    instanceWrapCount: PROPERTY_SCHEMAS.instanceWrapCount,
  },
};
