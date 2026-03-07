// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { ActionButtonComp } from "./ActionButtonComp";
import { COMMON_PROPS, PROPERTY_SCHEMAS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import SendIcon from "@mui/icons-material/Send";
import { COLORS } from "@src/constants/constants";

export const ActionButton: WidgetDefinition = {
  component: ActionButtonComp,
  widgetName: "ActionButton",
  widgetIcon: SendIcon,
  widgetLabel: "Action Button",
  category: "Controls",
  defaultProperties: {
    label: { ...PROPERTY_SCHEMAS.label, value: "Action Button" },
    ...COMMON_PROPS,
    ...TEXT_PROPS,
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: COLORS.buttonColor },
    pvName: PROPERTY_SCHEMAS.pvName,
    actionValue: PROPERTY_SCHEMAS.actionValue,
    disabled: PROPERTY_SCHEMAS.disabled,
  },
};
