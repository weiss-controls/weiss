// SPDX-License-Identifier: GPL-3.0-or-later
// Histogram widget for WEISS
// Contributed by Elmaddin Guliyev

import { HistogramComp } from "./HistogramComp";
import { COMMON_PROPS, PROPERTY_SCHEMAS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import BarChartIcon from "@mui/icons-material/BarChart";

export const Histogram: WidgetDefinition = {
  component: HistogramComp,
  widgetName: "Histogram",
  widgetIcon: BarChartIcon,
  widgetLabel: "Histogram",
  category: "Monitoring",
  defaultProperties: {
    pvName: PROPERTY_SCHEMAS.pvName,
    ...COMMON_PROPS,
    tooltip: { ...PROPERTY_SCHEMAS.tooltip, value: "" },
    width: { ...PROPERTY_SCHEMAS.width, value: 480 },
    height: { ...PROPERTY_SCHEMAS.height, value: 300 },
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: "white" },
    barColor: PROPERTY_SCHEMAS.barColor,
    plotBufferSize: PROPERTY_SCHEMAS.plotBufferSize,
    plotTitle: PROPERTY_SCHEMAS.plotTitle,
    xAxisTitle: PROPERTY_SCHEMAS.xAxisTitle,
    yAxisTitle: PROPERTY_SCHEMAS.yAxisTitle,
    ...TEXT_PROPS,
    textVAlign: { ...PROPERTY_SCHEMAS.textVAlign, value: "top" },
    textHAlign: { ...PROPERTY_SCHEMAS.textHAlign, value: "center" },
  },
};
