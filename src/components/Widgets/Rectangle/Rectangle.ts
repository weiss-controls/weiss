// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { COLORS } from "@src/constants/constants";
import type { WidgetDefinition } from "@src/types/widgets";
import { PROPERTY_SCHEMAS, COMMON_PROPS } from "@src/types/widgetProperties";
import { RectangleComp } from "./RectangleComp";
import RectangleIcon from "@mui/icons-material/Rectangle";

const { alarmBorder, ...FILTERED_COMMON_PROPS } = COMMON_PROPS;

export const Rectangle: WidgetDefinition = {
  component: RectangleComp,
  widgetName: "Rectangle",
  widgetIcon: RectangleIcon,
  widgetLabel: "Rectangle",
  category: "Basic",
  defaultProperties: {
    ...FILTERED_COMMON_PROPS,
    width: { ...PROPERTY_SCHEMAS.width, value: 80 },
    height: { ...PROPERTY_SCHEMAS.height, value: 80 },
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: COLORS.lightGray },
  },
};
