// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { PROPERTY_SCHEMAS, COMMON_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import { AreaDetectorComp } from "./AreaDetectorComp";
import GradientIcon from "@mui/icons-material/Gradient";

const { alarmBorder, ...FILTERED_COMMON_PROPS } = COMMON_PROPS;

export const AreaDetector: WidgetDefinition = {
  component: AreaDetectorComp,
  widgetName: "AreaDetector",
  widgetIcon: GradientIcon,
  widgetLabel: "Area Detector",
  category: "Monitoring",
  defaultProperties: {
    ...FILTERED_COMMON_PROPS,
    tooltip: { ...PROPERTY_SCHEMAS.tooltip, value: "" },
    width: { ...PROPERTY_SCHEMAS.width, value: 480 },
    height: { ...PROPERTY_SCHEMAS.height, value: 360 },
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: "black" },
    pvName: PROPERTY_SCHEMAS.pvName,
    sizeXPV: PROPERTY_SCHEMAS.sizeXPV,
    sizeYPV: PROPERTY_SCHEMAS.sizeYPV,
    dataTypePV: PROPERTY_SCHEMAS.dataTypePV,
    imageRotation: PROPERTY_SCHEMAS.imageRotation,
    imageFlipX: PROPERTY_SCHEMAS.imageFlipX,
    imageFlipY: PROPERTY_SCHEMAS.imageFlipY,
    showPixelReadout: PROPERTY_SCHEMAS.showPixelReadout,
    colorMap: PROPERTY_SCHEMAS.colorMap,
    autoLimits: PROPERTY_SCHEMAS.autoLimits,
    min: { ...PROPERTY_SCHEMAS.min, label: "Intensity minimum", category: "Layout" },
    max: { ...PROPERTY_SCHEMAS.max, label: "Intensity maximum", value: 255, category: "Layout" },
    logIntensity: PROPERTY_SCHEMAS.logIntensity,
    showColorbar: PROPERTY_SCHEMAS.showColorbar,
    textColor: { ...PROPERTY_SCHEMAS.textColor, value: "white" },
    fontSize: { ...PROPERTY_SCHEMAS.fontSize, value: 11 },
  },
};
