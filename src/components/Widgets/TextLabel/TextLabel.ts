// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { PROPERTY_SCHEMAS, COMMON_PROPS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { Widget } from "@src/types/widgets";
import { TextLabelComp } from "./TextLabelComp";
import TextFieldsIcon from "@mui/icons-material/TextFields";

export const TextLabel: Widget = {
  id: "__TextLabel__",
  component: TextLabelComp,
  widgetName: "TextLabel",
  widgetIcon: TextFieldsIcon,
  widgetLabel: "Text Label",
  category: "Basic",
  editableProperties: {
    label: { ...PROPERTY_SCHEMAS.label, value: "Text Label" },
    ...COMMON_PROPS,
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: "transparent" },
    ...TEXT_PROPS,
  },
} as const;
