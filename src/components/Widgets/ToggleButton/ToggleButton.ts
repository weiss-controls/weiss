// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { ToggleButtonComp } from "./ToggleButtonComp";
import { COMMON_PROPS, PROPERTY_SCHEMAS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import { COLORS } from "@src/constants/constants";

export const ToggleButton: WidgetDefinition = {
  component: ToggleButtonComp,
  widgetName: "ToggleButton",
  widgetIcon: PowerSettingsNewIcon,
  widgetLabel: "Toggle Button",
  category: "Controls",
  defaultProperties: {
    ...COMMON_PROPS,
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: COLORS.buttonColor },
    pvName: PROPERTY_SCHEMAS.pvName,
    disabled: PROPERTY_SCHEMAS.disabled,
    alarmBorder: PROPERTY_SCHEMAS.alarmBorder,
    labelFromPV: PROPERTY_SCHEMAS.labelFromPV,
    useStringVal: PROPERTY_SCHEMAS.useStringVal,
    offLabel: PROPERTY_SCHEMAS.offLabel,
    onLabel: PROPERTY_SCHEMAS.onLabel,
    onColor: PROPERTY_SCHEMAS.onColor,
    offColor: PROPERTY_SCHEMAS.offColor,
    ...TEXT_PROPS,
  },
};
