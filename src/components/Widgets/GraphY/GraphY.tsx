// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { GraphYComp } from "./GraphYComp";
import {
  COMMON_PROPS,
  PLOT_PROPS,
  PROPERTY_SCHEMAS,
  TEXT_PROPS,
} from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import StackedLineChartIcon from "@mui/icons-material/StackedLineChart";

export const GraphY: WidgetDefinition = {
  component: GraphYComp,
  widgetName: "GraphY",
  widgetIcon: StackedLineChartIcon,
  widgetLabel: "Graph Y",
  category: "Monitoring",
  defaultProperties: {
    ...COMMON_PROPS,
    width: { ...PROPERTY_SCHEMAS.width, value: 480 },
    height: { ...PROPERTY_SCHEMAS.height, value: 260 },
    ...PLOT_PROPS,
    ...TEXT_PROPS,
    textVAlign: { ...PROPERTY_SCHEMAS.textVAlign, value: "top" },
    textHAlign: { ...PROPERTY_SCHEMAS.textHAlign, value: "center" },
  },
};
