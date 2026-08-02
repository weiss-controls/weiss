// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { NavigationButtonComp } from "./NavigationButtonComp";
import { COMMON_PROPS, PROPERTY_SCHEMAS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { COLORS } from "@src/constants/constants";

const { alarmBorder, ...FILTERED_COMMON } = COMMON_PROPS;
export const NavigationButton: WidgetDefinition = {
  component: NavigationButtonComp,
  widgetName: "NavigationButton",
  widgetIcon: OpenInNewIcon,
  widgetLabel: "Navigation Button",
  category: "Controls",
  defaultProperties: {
    label: { ...PROPERTY_SCHEMAS.label, value: "Navigate" },
    ...FILTERED_COMMON,
    ...TEXT_PROPS,
    backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: COLORS.buttonColor },
    displayPath: PROPERTY_SCHEMAS.displayPath,
    target: PROPERTY_SCHEMAS.target,
    disabled: PROPERTY_SCHEMAS.disabled,
    tooltip: { ...PROPERTY_SCHEMAS.tooltip, value: "" },
    macros: { ...PROPERTY_SCHEMAS.macros },
  },
};
