// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { PROPERTY_SCHEMAS, COMMON_PROPS, TEXT_PROPS } from "@src/types/widgetProperties";
import type { WidgetDefinition } from "@src/types/widgets";
import { NavigationTabsComp } from "./NavigationTabsComp";
import TabIcon from "@mui/icons-material/Tab";

const { alarmBorder, ...COMMON_WO_ALARMS } = COMMON_PROPS;
const { textVAlign, textHAlign, ...TEXT_WO_ALIGN } = TEXT_PROPS;

export const NavigationTabs: WidgetDefinition = {
  component: NavigationTabsComp,
  widgetName: "NavigationTabs",
  widgetIcon: TabIcon,
  widgetLabel: "Navigation Tabs",
  category: "Layout",
  defaultProperties: {
    ...COMMON_WO_ALARMS,
    width: { ...PROPERTY_SCHEMAS.width, value: 600 },
    height: { ...PROPERTY_SCHEMAS.height, value: 330 },
    tooltip: { ...PROPERTY_SCHEMAS.tooltip, value: "" },
    ...TEXT_WO_ALIGN,
    tabs: PROPERTY_SCHEMAS.tabs,
    tabOrientation: PROPERTY_SCHEMAS.tabOrientation,
    activeTabColor: PROPERTY_SCHEMAS.activeTabColor,
  },
};
