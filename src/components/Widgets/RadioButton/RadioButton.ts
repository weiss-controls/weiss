// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { RadioButtonComp } from "./RadioButtonComp";
import { COMMON_PROPS, PROPERTY_SCHEMAS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";

export const RadioButton: WidgetDefinition = {
  component: RadioButtonComp,
  widgetName: "RadioButton",
  widgetLabel: "Radio Button",
  widgetIcon: RadioButtonCheckedIcon,
  category: "Controls",
  defaultProperties: {
    ...COMMON_PROPS,
    height: { ...PROPERTY_SCHEMAS.height, value: 60 },
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: "transparent" },
    pvName: PROPERTY_SCHEMAS.pvName,
    disabled: PROPERTY_SCHEMAS.disabled,
    labelFromPV: { ...PROPERTY_SCHEMAS.labelFromPV, value: true },
    enumChoices: PROPERTY_SCHEMAS.enumChoices,
    horizontal: PROPERTY_SCHEMAS.horizontal,
    labelPlcmnt: {
      ...PROPERTY_SCHEMAS.labelPlcmnt,
      value: "end",
      options: ["end", "start", "top", "bottom"],
    },
    unselectedColor: PROPERTY_SCHEMAS.unselectedColor,
    selectedColor: PROPERTY_SCHEMAS.selectedColor,
    ...TEXT_PROPS,
  },
};
