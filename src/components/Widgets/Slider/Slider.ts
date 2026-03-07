// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { SliderComp } from "./SliderComp.tsx";
import { COLORS } from "@src/constants/constants";
import type { WidgetDefinition } from "@src/types/widgets";
import CustomSliderIcon from "@src/components/CustomIcons/SliderIcon";
import { PROPERTY_SCHEMAS, COMMON_PROPS } from "@src/types/widgetProperties";

export const Slider: WidgetDefinition = {
  component: SliderComp,
  widgetName: "Slider",
  widgetIcon: CustomSliderIcon,
  widgetLabel: "Slider",
  category: "Controls",
  defaultProperties: {
    ...COMMON_PROPS,
    width: { ...PROPERTY_SCHEMAS.width, value: 50 },
    height: { ...PROPERTY_SCHEMAS.height, value: 260 },
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: COLORS.midDarkBlue },
    pvName: PROPERTY_SCHEMAS.pvName,
    disabled: PROPERTY_SCHEMAS.disabled,
    alarmBorder: PROPERTY_SCHEMAS.alarmBorder,
    min: PROPERTY_SCHEMAS.min,
    max: PROPERTY_SCHEMAS.max,
    limitsFromPV: PROPERTY_SCHEMAS.limitsFromPV,
    stepSize: PROPERTY_SCHEMAS.stepSize,
    horizontal: PROPERTY_SCHEMAS.horizontal,
  },
};
