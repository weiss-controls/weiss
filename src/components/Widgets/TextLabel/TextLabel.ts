// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { PROPERTY_SCHEMAS, COMMON_PROPS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import { TextLabelComp } from "./TextLabelComp";
import TextFieldsIcon from "@mui/icons-material/TextFields";

const { alarmBorder, ...COMMON_WO_ALARMS } = COMMON_PROPS;

export const TextLabel: WidgetDefinition = {
  component: TextLabelComp,
  widgetName: "TextLabel",
  widgetIcon: TextFieldsIcon,
  widgetLabel: "Text Label",
  category: "Basic",
  defaultProperties: {
    label: { ...PROPERTY_SCHEMAS.label, value: "Text Label" },
    ...COMMON_WO_ALARMS,
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: "transparent" },
    ...TEXT_PROPS,
    tooltip: { ...PROPERTY_SCHEMAS.tooltip, value: "" },
  },
};
