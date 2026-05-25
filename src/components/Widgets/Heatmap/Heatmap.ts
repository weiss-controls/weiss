// SPDX-License-Identifier: GPL-3.0-or-later
// Heatmap widget for WEISS  designed for areaDetector imaging
// Contributed by Elmaddin Guliyev

import { HeatmapComp } from "./HeatmapComp";
import { COMMON_PROPS, PROPERTY_SCHEMAS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import GridOnIcon from "@mui/icons-material/GridOn";

export const Heatmap: WidgetDefinition = {
  component: HeatmapComp,
  widgetName: "Heatmap",
  widgetIcon: GridOnIcon,
  widgetLabel: "Heatmap",
  category: "Monitoring",
  defaultProperties: {
    pvName: PROPERTY_SCHEMAS.pvName,
    ...COMMON_PROPS,
    tooltip: { ...PROPERTY_SCHEMAS.tooltip, value: "" },
    width: { ...PROPERTY_SCHEMAS.width, value: 480 },
    height: { ...PROPERTY_SCHEMAS.height, value: 400 },
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: "white" },
    plotTitle: PROPERTY_SCHEMAS.plotTitle,
    xAxisTitle: PROPERTY_SCHEMAS.xAxisTitle,
    yAxisTitle: PROPERTY_SCHEMAS.yAxisTitle,
    ...TEXT_PROPS,
    textVAlign: { ...PROPERTY_SCHEMAS.textVAlign, value: "top" },
    textHAlign: { ...PROPERTY_SCHEMAS.textHAlign, value: "center" },
  },
};
