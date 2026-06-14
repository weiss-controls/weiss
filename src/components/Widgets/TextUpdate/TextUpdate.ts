// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { TextUpdateComp } from "./TextUpdateComp";
import { PROPERTY_SCHEMAS, COMMON_PROPS, TEXT_PROPS } from "@src/types/widgetProperties";
import { COLORS } from "@src/constants/constants";
import type { WidgetDefinition } from "@src/types/widgets";
import TextsmsIcon from "@mui/icons-material/Textsms";

export const TextUpdate: WidgetDefinition = {
  component: TextUpdateComp,
  widgetName: "TextUpdate",
  widgetIcon: TextsmsIcon,
  widgetLabel: "Text Update",
  category: "Monitoring",
  defaultProperties: {
    label: { ...PROPERTY_SCHEMAS.label, value: "Text Update" },
    ...COMMON_PROPS,
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: COLORS.readColor },
    ...TEXT_PROPS,
    pvName: PROPERTY_SCHEMAS.pvName,
    alarmBorder: PROPERTY_SCHEMAS.alarmBorder,
    unitsFromPV: PROPERTY_SCHEMAS.unitsFromPV,
    units: PROPERTY_SCHEMAS.units,
    precisionFromPV: PROPERTY_SCHEMAS.precisionFromPV,
    precision: PROPERTY_SCHEMAS.precision,
    displayFormat: PROPERTY_SCHEMAS.displayFormat,
  },
};
