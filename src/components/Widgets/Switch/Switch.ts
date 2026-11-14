// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

import { SwitchComp } from "./SwitchComp";
import { COMMON_PROPS, PROPERTY_SCHEMAS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";

export const Switch: WidgetDefinition = {
  component: SwitchComp,
  widgetName: "Switch",
  widgetLabel: "Switch",
  widgetIcon: ToggleOnIcon,
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
    onColor: PROPERTY_SCHEMAS.onColor,
    offColor: PROPERTY_SCHEMAS.offColor,
    ...TEXT_PROPS,
  },
};
