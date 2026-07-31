// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { SelectionBoxComp } from "./SelectionBoxComp";
import { COMMON_PROPS, PROPERTY_SCHEMAS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import CustomDropdownIcon from "@src/components/CustomIcons/DropDownIcon";

const { textVAlign, textHAlign, ...FILTERED_TEXT_PROPS } = TEXT_PROPS;

export const SelectionBox: WidgetDefinition = {
  component: SelectionBoxComp,
  widgetName: "SelectionBox",
  widgetIcon: CustomDropdownIcon,
  widgetLabel: "Selection Box",
  category: "Controls",
  defaultProperties: {
    label: { ...PROPERTY_SCHEMAS.label, value: "Selection Box" },
    ...COMMON_PROPS,
    ...FILTERED_TEXT_PROPS,
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: "transparent" },
    pvName: PROPERTY_SCHEMAS.pvName,
    disabled: PROPERTY_SCHEMAS.disabled,
    alarmBorder: PROPERTY_SCHEMAS.alarmBorder,
    enumChoices: PROPERTY_SCHEMAS.enumChoices,
    labelFromPV: { ...PROPERTY_SCHEMAS.labelFromPV, value: true },
    textVAlign: PROPERTY_SCHEMAS.textVAlign,
    textHAlign: PROPERTY_SCHEMAS.textHAlign,
  },
};
