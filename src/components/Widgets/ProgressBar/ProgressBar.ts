// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { ProgressBarComp } from "./ProgressBarComp";
import { COMMON_PROPS, PROPERTY_SCHEMAS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import PercentIcon from "@mui/icons-material/Percent";

export const ProgressBar: WidgetDefinition = {
  component: ProgressBarComp,
  widgetName: "ProgressBar",
  widgetLabel: "Progress Bar",
  widgetIcon: PercentIcon,
  category: "Monitoring",
  defaultProperties: {
    ...COMMON_PROPS,
    pvName: PROPERTY_SCHEMAS.pvName,
    limitsFromPV: PROPERTY_SCHEMAS.limitsFromPV,
    min: PROPERTY_SCHEMAS.min,
    max: PROPERTY_SCHEMAS.max,
    horizontal: PROPERTY_SCHEMAS.horizontal,
    showValue: PROPERTY_SCHEMAS.showValue,
    valuePlcmnt: PROPERTY_SCHEMAS.valuePlcmnt,
    showPercentage: PROPERTY_SCHEMAS.showPercentage,
    barColor: PROPERTY_SCHEMAS.barColor,
    ...TEXT_PROPS,
  },
};
