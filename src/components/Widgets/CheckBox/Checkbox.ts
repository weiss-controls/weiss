// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { CheckboxComp } from "./CheckboxComp";
import { COMMON_PROPS, PROPERTY_SCHEMAS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import CheckBoxIcon from "@mui/icons-material/CheckBox";

export const Checkbox: WidgetDefinition = {
  component: CheckboxComp,
  widgetName: "Checkbox",
  widgetLabel: "Checkbox",
  widgetIcon: CheckBoxIcon,
  category: "Controls",
  defaultProperties: {
    label: { ...PROPERTY_SCHEMAS.label, value: "Label" },
    ...COMMON_PROPS,
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: "transparent" },
    pvName: PROPERTY_SCHEMAS.pvName,
    disabled: PROPERTY_SCHEMAS.disabled,
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
