// SPDX-License-Identifier: GPL-3.0-or-later
// Heatmap widget for WEISS — designed for areaDetector imaging
// Contributed by Elmaddin Guliyev

import { HeatmapComp } from "./HeatmapComp";
import { COMMON_PROPS, PROPERTY_SCHEMAS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import GradientIcon from "@mui/icons-material/Gradient";

export const Heatmap: WidgetDefinition = {
  component: HeatmapComp,
  widgetName: "Heatmap",
  widgetIcon: GradientIcon,
  widgetLabel: "Heatmap",
  category: "Monitoring",
  defaultProperties: {
    // pvNames[0] = image data array
    // pvNames[1] = Size X PV   (used when dimsFromPVs is true)
    // pvNames[2] = Size Y PV   (used when dimsFromPVs is true)
    pvNames: PROPERTY_SCHEMAS.pvNames,
    dimsFromPVs: PROPERTY_SCHEMAS.dimsFromPVs,
    imageSizeX: PROPERTY_SCHEMAS.imageSizeX,
    imageSizeY: PROPERTY_SCHEMAS.imageSizeY,
    ...COMMON_PROPS,
    tooltip: { ...PROPERTY_SCHEMAS.tooltip, value: "" },
    width: { ...PROPERTY_SCHEMAS.width, value: 480 },
    height: { ...PROPERTY_SCHEMAS.height, value: 360 },
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: "white" },
    colorScale: PROPERTY_SCHEMAS.colorScale,
    plotTitle: PROPERTY_SCHEMAS.plotTitle,
    xAxisTitle: PROPERTY_SCHEMAS.xAxisTitle,
    yAxisTitle: PROPERTY_SCHEMAS.yAxisTitle,
    ...TEXT_PROPS,
    textVAlign: { ...PROPERTY_SCHEMAS.textVAlign, value: "top" },
    textHAlign: { ...PROPERTY_SCHEMAS.textHAlign, value: "center" },
  },
};
