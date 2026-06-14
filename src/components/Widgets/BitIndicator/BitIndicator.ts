// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { BitIndicatorComp } from "./BitIndicatorComp";
import { PROPERTY_SCHEMAS, COMMON_PROPS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import FlakyIcon from "@mui/icons-material/Flaky";

const { borderRadius, backgroundColor, ...FILTERED_COMMON_PROPS } = COMMON_PROPS;
const { textVAlign, textHAlign, ...FILTERED_TEXT_PROPS } = TEXT_PROPS;

export const BitIndicator: WidgetDefinition = {
  component: BitIndicatorComp,
  widgetName: "BitIndicator",
  widgetIcon: FlakyIcon,
  widgetLabel: "Bit Indicator",
  category: "Monitoring",
  defaultProperties: {
    ...FILTERED_COMMON_PROPS,
    width: { ...PROPERTY_SCHEMAS.width, value: 95 },
    height: { ...PROPERTY_SCHEMAS.height, value: 40 },
    onColor: PROPERTY_SCHEMAS.onColor,
    offColor: PROPERTY_SCHEMAS.offColor,
    square: PROPERTY_SCHEMAS.square,
    pvName: PROPERTY_SCHEMAS.pvName,
    alarmBorder: PROPERTY_SCHEMAS.alarmBorder,
    labelFromPV: PROPERTY_SCHEMAS.labelFromPV,
    useStringVal: PROPERTY_SCHEMAS.useStringVal,
    offLabel: PROPERTY_SCHEMAS.offLabel,
    onLabel: PROPERTY_SCHEMAS.onLabel,
    displayFormat: PROPERTY_SCHEMAS.displayFormat,
    ...FILTERED_TEXT_PROPS,
  },
};
