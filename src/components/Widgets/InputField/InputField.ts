// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { InputFieldComp } from "./InputFieldComp";
import { COLORS } from "@src/constants/constants";
import type { Widget } from "@src/types/widgets";
import InputIcon from "@mui/icons-material/Input";
import { PROPERTY_SCHEMAS, COMMON_PROPS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { PVData } from "@src/types/epicsWS";

const { textVAlign, textHAlign, ...FILTERED_TEXT_PROPS } = TEXT_PROPS;

export const InputField: Widget = {
  id: "__InputField__",
  component: InputFieldComp,
  widgetName: "InputField",
  widgetIcon: InputIcon,
  widgetLabel: "Input Field",
  category: "Controls",
  pvData: {} as PVData,
  editableProperties: {
    pvName: PROPERTY_SCHEMAS.pvName,
    unitsFromPV: PROPERTY_SCHEMAS.unitsFromPV,
    units: PROPERTY_SCHEMAS.units,
    disabled: PROPERTY_SCHEMAS.disabled,
    ...COMMON_PROPS,
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: COLORS.inputColor },
    ...FILTERED_TEXT_PROPS,
  },
} as const;
