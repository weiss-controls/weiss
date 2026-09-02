// SPDX-License-Identifier: GPL-3.0-or-later
// GraphXY widget for WEISS
// Contributed by Elmaddin Guliyev

import { GraphXYComp } from "./GraphXYComp";
import {
  COMMON_PROPS,
  PLOT_PROPS,
  PROPERTY_SCHEMAS,
  TEXT_PROPS,
} from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import TimelineIcon from "@mui/icons-material/Timeline";

export const GraphXY: WidgetDefinition = {
  component: GraphXYComp,
  widgetName: "GraphXY",
  widgetIcon: TimelineIcon,
  widgetLabel: "Graph XY",
  category: "Plots",
  defaultProperties: {
    ...COMMON_PROPS,
    tooltip: { ...PROPERTY_SCHEMAS.tooltip, value: "" },
    width: { ...PROPERTY_SCHEMAS.width, value: 480 },
    height: { ...PROPERTY_SCHEMAS.height, value: 400 },
    ...PLOT_PROPS,
    plotLineStyle: { ...PROPERTY_SCHEMAS.plotLineStyle, value: "lines+markers" },
    ...TEXT_PROPS,
    textVAlign: { ...PROPERTY_SCHEMAS.textVAlign, value: "top" },
    textHAlign: { ...PROPERTY_SCHEMAS.textHAlign, value: "center" },
  },
};
