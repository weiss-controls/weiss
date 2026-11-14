// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { ChoiceButtonComp } from "./ChoiceButtonComp";
import { COMMON_PROPS, PROPERTY_SCHEMAS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import { COLORS } from "@src/constants/constants";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";

export const ChoiceButton: WidgetDefinition = {
  component: ChoiceButtonComp,
  widgetName: "ChoiceButton",
  widgetLabel: "Choice Button",
  widgetIcon: ViewWeekIcon,
  category: "Controls",
  defaultProperties: {
    ...COMMON_PROPS,
    width: { ...PROPERTY_SCHEMAS.width, value: 200 },
    height: { ...PROPERTY_SCHEMAS.height, value: 35 },
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: "transparent" },
    pvName: PROPERTY_SCHEMAS.pvName,
    disabled: PROPERTY_SCHEMAS.disabled,
    labelFromPV: { ...PROPERTY_SCHEMAS.labelFromPV, value: true },
    enumChoices: PROPERTY_SCHEMAS.enumChoices,
    horizontal: { ...PROPERTY_SCHEMAS.horizontal, value: true },
    unselectedColor: { ...PROPERTY_SCHEMAS.unselectedColor, value: COLORS.buttonColor },
    selectedColor: { ...PROPERTY_SCHEMAS.selectedColor, value: COLORS.gray },
    ...TEXT_PROPS,
    textHAlign: { ...PROPERTY_SCHEMAS.textHAlign, value: "center" },
  },
};
