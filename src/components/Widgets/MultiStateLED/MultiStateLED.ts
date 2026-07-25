// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { MultiStateLEDComp } from "./MultiStateLEDComp";
import { PROPERTY_SCHEMAS, COMMON_PROPS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import TonalityIcon from "@mui/icons-material/Tonality";

const { borderRadius, backgroundColor, ...FILTERED_COMMON_PROPS } = COMMON_PROPS;
const { textVAlign, textHAlign, ...FILTERED_TEXT_PROPS } = TEXT_PROPS;

export const MultiStateLED: WidgetDefinition = {
  component: MultiStateLEDComp,
  widgetName: "MultiStateLED",
  widgetIcon: TonalityIcon,
  widgetLabel: "Multi-State LED",
  category: "Monitoring",
  defaultProperties: {
    ...FILTERED_COMMON_PROPS,
    width: { ...PROPERTY_SCHEMAS.width, value: 95 },
    height: { ...PROPERTY_SCHEMAS.height, value: 40 },
    pvName: PROPERTY_SCHEMAS.pvName,
    stateList: PROPERTY_SCHEMAS.stateList,
    labelFromPV: PROPERTY_SCHEMAS.labelFromPV,
    square: PROPERTY_SCHEMAS.square,
    alarmBorder: PROPERTY_SCHEMAS.alarmBorder,
    displayFormat: PROPERTY_SCHEMAS.displayFormat,
    ...FILTERED_TEXT_PROPS,
  },
};
