// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { PROPERTY_SCHEMAS, COMMON_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import { AreaDetectorComp } from "./AreaDetectorComp";
import CameraAltIcon from "@mui/icons-material/CameraAlt";

const { alarmBorder, ...FILTERED_COMMON_PROPS } = COMMON_PROPS;

export const AreaDetector: WidgetDefinition = {
  component: AreaDetectorComp,
  widgetName: "AreaDetector",
  widgetIcon: CameraAltIcon,
  widgetLabel: "Area Detector",
  category: "Monitoring",
  defaultProperties: {
    ...FILTERED_COMMON_PROPS,
    tooltip: { ...PROPERTY_SCHEMAS.tooltip, value: "" },
    width: { ...PROPERTY_SCHEMAS.width, value: 480 },
    height: { ...PROPERTY_SCHEMAS.height, value: 360 },
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: "black" },
    pvName: PROPERTY_SCHEMAS.pvName,
  },
};
