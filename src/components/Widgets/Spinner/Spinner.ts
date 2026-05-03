// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Marco Montevechi, André Favoto

import { SpinnerComp } from "./SpinnerComp";
import { COLORS } from "@src/constants/constants";
import type { WidgetDefinition } from "@src/types/widgets";
import PinRoundedIcon from "@mui/icons-material/PinRounded";
import { PROPERTY_SCHEMAS, COMMON_PROPS, TEXT_PROPS } from "@src/types/widgetProperties";

export const Spinner: WidgetDefinition = {
  component: SpinnerComp,
  widgetName: "Spinner",
  widgetIcon: PinRoundedIcon,
  widgetLabel: "Spinner",
  category: "Controls",
  defaultProperties: {
    pvName: PROPERTY_SCHEMAS.pvName,
    unitsFromPV: PROPERTY_SCHEMAS.unitsFromPV,
    units: PROPERTY_SCHEMAS.units,
    disabled: PROPERTY_SCHEMAS.disabled,
    ...COMMON_PROPS,
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: COLORS.inputColor },
    ...TEXT_PROPS,
    limitsFromPV: PROPERTY_SCHEMAS.limitsFromPV,
    min: PROPERTY_SCHEMAS.min,
    max: PROPERTY_SCHEMAS.max,
  },
};
