// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { MultiBitIndicatorComp } from "./MultiBitIndicatorComp";
import { PROPERTY_SCHEMAS, COMMON_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import CustomMultiBitIcon from "@src/components/CustomIcons/MultiBitIcon";

const { borderRadius, backgroundColor, ...FILTERED_COMMON_PROPS } = COMMON_PROPS;

export const MultiBitIndicator: WidgetDefinition = {
  component: MultiBitIndicatorComp,
  widgetName: "MultiBitIndicator",
  widgetIcon: CustomMultiBitIcon,
  widgetLabel: "Multi-Bit Indicator",
  category: "Monitoring",
  defaultProperties: {
    ...FILTERED_COMMON_PROPS,
    width: { ...PROPERTY_SCHEMAS.width, value: 40 },
    height: { ...PROPERTY_SCHEMAS.height, value: 320 },
    onColor: PROPERTY_SCHEMAS.onColor,
    offColor: PROPERTY_SCHEMAS.offColor,
    nBits: PROPERTY_SCHEMAS.nBits,
    square: PROPERTY_SCHEMAS.square,
    horizontal: PROPERTY_SCHEMAS.horizontal,
    invertBitOrder: PROPERTY_SCHEMAS.invertBitOrder,
    spacing: PROPERTY_SCHEMAS.spacing,
    pvName: PROPERTY_SCHEMAS.pvName,
    alarmBorder: PROPERTY_SCHEMAS.alarmBorder,
  },
};
