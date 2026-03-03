// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { GraphYComp } from "./GraphYComp";
import {
  COMMON_PROPS,
  PLOT_PROPS,
  PROPERTY_SCHEMAS,
  TEXT_PROPS,
} from "@src/types/widgetProperties";
import type { Widget } from "@src/types/widgets";
import StackedLineChartIcon from "@mui/icons-material/StackedLineChart";
import type { MultiPvData } from "@src/types/epicsWS";

export const GraphY: Widget = {
  id: "__GraphYComp__",
  component: GraphYComp,
  widgetName: "GraphY",
  widgetIcon: StackedLineChartIcon,
  widgetLabel: "Graph Y",
  category: "Monitoring",
  multiPvData: {} as MultiPvData,
  editableProperties: {
    ...COMMON_PROPS,
    width: { ...PROPERTY_SCHEMAS.width, value: 480 },
    height: { ...PROPERTY_SCHEMAS.height, value: 260 },
    ...PLOT_PROPS,
    ...TEXT_PROPS,
    textVAlign: { ...PROPERTY_SCHEMAS.textVAlign, value: "top" },
    textHAlign: { ...PROPERTY_SCHEMAS.textHAlign, value: "center" },
  },
} as const;
