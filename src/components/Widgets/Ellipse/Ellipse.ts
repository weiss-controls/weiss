// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { COLORS } from "@src/constants/constants";
import type { WidgetDefinition } from "@src/types/widgets";
import { COMMON_PROPS, PROPERTY_SCHEMAS } from "@src/types/widgetProperties";
import { EllipseComp } from "./EllipseComp";
import CircleIcon from "@mui/icons-material/Circle";

const { borderRadius, alarmBorder, ...FILTERED_COMMON_PROPS } = COMMON_PROPS;

export const Ellipse: WidgetDefinition = {
  component: EllipseComp,
  widgetName: "Ellipse",
  widgetIcon: CircleIcon,
  widgetLabel: "Ellipse",
  category: "Basic",
  defaultProperties: {
    ...FILTERED_COMMON_PROPS,
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: COLORS.lightGray },
    width: { ...PROPERTY_SCHEMAS.width, value: 80 },
    height: { ...PROPERTY_SCHEMAS.height, value: 80 },
    tooltip: { ...PROPERTY_SCHEMAS.tooltip, value: "" },
  },
};
