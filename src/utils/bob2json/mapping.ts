// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

/**
 * Phoebus -> WEISS widget and property mapping.
 *
 * Properties not listed in propMap are dropped during conversion.
 * Properties that require transformation (e.g. color, font) are handled by
 * dedicated transform functions in the converter.
 */

import { PhoebusProperty, PhoebusWidgetType } from "./constants";
import type { PropertyMap, WidgetMapEntry } from "./types";

/**
 * Properties shared by most widgets on both sides.
 * Spread this into each entry's propMap and override where needed.
 */
const COMMON_PROP_MAP: PropertyMap = {
  [PhoebusProperty.NAME]: "alias",
  [PhoebusProperty.X]: "x",
  [PhoebusProperty.Y]: "y",
  [PhoebusProperty.WIDTH]: "width",
  [PhoebusProperty.HEIGHT]: "height",
  [PhoebusProperty.TOOLTIP]: "tooltip",
  [PhoebusProperty.VISIBLE]: "visible",
};

const STYLE_PROP_MAP: PropertyMap = {
  [PhoebusProperty.LINE_COLOR]: "borderColor",
  [PhoebusProperty.LINE_WIDTH]: "borderWidth",
  [PhoebusProperty.LINE_STYLE]: "borderStyle",
  [PhoebusProperty.BACKGROUND_COLOR]: "backgroundColor",
};
/**
 * Text/font-related properties shared by label, text_update, text_entry, buttons.
 * FONT itself is not in this map; the converter handles font decomposition.
 */
const TEXT_PROP_MAP: PropertyMap = {
  [PhoebusProperty.FOREGROUND_COLOR]: "textColor",
  [PhoebusProperty.HORIZONTAL_ALIGNMENT]: "textHAlign",
  [PhoebusProperty.VERTICAL_ALIGNMENT]: "textVAlign",
};

/** Single-state LEDs often carry explicit on/off colors and labels in Phoebus. */
const SINGLE_LED_PROP_MAP: PropertyMap = {
  [PhoebusProperty.ON_COLOR]: "onColor",
  [PhoebusProperty.OFF_COLOR]: "offColor",
  [PhoebusProperty.ON_LABEL]: "onLabel",
  [PhoebusProperty.OFF_LABEL]: "offLabel",
};

export const WIDGET_MAP: Partial<Record<PhoebusWidgetType, WidgetMapEntry>> = {
  // Display / text

  [PhoebusWidgetType.LABEL]: {
    weissName: "TextLabel",
    hasFont: true,
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
      ...TEXT_PROP_MAP,
      [PhoebusProperty.TEXT]: "label",
    },
  },

  [PhoebusWidgetType.TEXT_UPDATE]: {
    weissName: "TextUpdate",
    hasFont: true,
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
      ...TEXT_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
    },
  },

  [PhoebusWidgetType.TEXT_ENTRY]: {
    weissName: "InputField",
    hasFont: true,
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
      ...TEXT_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.ENABLED]: "disabled",
    },
  },

  // Monitors

  [PhoebusWidgetType.LED]: {
    weissName: "BitIndicator",
    hasFont: true,
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
      ...SINGLE_LED_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.SQUARE]: "square",
    },
  },

  [PhoebusWidgetType.BYTE_MONITOR]: {
    weissName: "MultiBitIndicator",
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
      [PhoebusProperty.ON_COLOR]: "onColor",
      [PhoebusProperty.OFF_COLOR]: "offColor",
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.HORIZONTAL]: "horizontal",
      [PhoebusProperty.NBITS]: "nBits",
    },
  },

  [PhoebusWidgetType.MULTI_STATE_LED]: {
    weissName: "MultiStateLED",
    hasFont: true,
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.STATES]: "stateList",
    },
  },

  [PhoebusWidgetType.PROGRESS_BAR]: {
    weissName: "ProgressBar",
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.FOREGROUND_COLOR]: "barColor",
    },
  },

  [PhoebusWidgetType.METER]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
    },
  },

  [PhoebusWidgetType.LINEAR_METER]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
    },
  },

  [PhoebusWidgetType.TANK]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
    },
  },

  [PhoebusWidgetType.THERMOMETER]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
    },
  },

  [PhoebusWidgetType.SYMBOL]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
    },
  },

  [PhoebusWidgetType.ARRAY]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
    },
  },

  // Controls

  [PhoebusWidgetType.ACTION_BUTTON]: {
    weissName: "ActionButton",
    hasFont: true,
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
      ...TEXT_PROP_MAP,
      [PhoebusProperty.TEXT]: "label",
      [PhoebusProperty.ENABLED]: "disabled",
    },
  },

  [PhoebusWidgetType.BOOLEAN_BUTTON]: {
    weissName: "ToggleButton",
    hasFont: true,
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
      ...TEXT_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.ENABLED]: "disabled",
    },
  },

  [PhoebusWidgetType.CHECK_BOX]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.TEXT]: "text",
      [PhoebusProperty.ENABLED]: "disabled",
    },
  },

  [PhoebusWidgetType.COMBO_BOX]: {
    weissName: "SelectionBox",
    hasFont: true,
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.ENABLED]: "disabled",
    },
  },

  [PhoebusWidgetType.CHOICE_BUTTON]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.ENABLED]: "disabled",
    },
  },

  [PhoebusWidgetType.SCALED_SLIDER]: {
    weissName: "Slider",
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.ENABLED]: "disabled",
    },
  },

  [PhoebusWidgetType.SPINNER]: {
    weissName: "Spinner",
    hasFont: true,
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
      ...TEXT_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.ENABLED]: "disabled",
    },
  },

  [PhoebusWidgetType.SCROLL_BAR]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.ENABLED]: "disabled",
    },
  },

  [PhoebusWidgetType.SLIDE_BUTTON]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.ENABLED]: "disabled",
    },
  },

  [PhoebusWidgetType.THUMBWHEEL]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.ENABLED]: "disabled",
    },
  },

  [PhoebusWidgetType.RADIO_BUTTON]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.ENABLED]: "disabled",
    },
  },

  [PhoebusWidgetType.TABLE]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
    },
  },

  [PhoebusWidgetType.FILE_SELECTOR]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.ENABLED]: "disabled",
    },
  },

  // Graphics

  [PhoebusWidgetType.RECTANGLE]: {
    weissName: "Rectangle",
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
    },
  },

  [PhoebusWidgetType.ELLIPSE]: {
    weissName: "Ellipse",
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
    },
  },

  [PhoebusWidgetType.POLYGON]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
    },
  },

  [PhoebusWidgetType.POLYLINE]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
    },
  },

  [PhoebusWidgetType.ARC]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
    },
  },

  [PhoebusWidgetType.PICTURE]: {
    weissName: "Image",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.FILE]: "imagePath",
    },
  },

  [PhoebusWidgetType.IMAGE]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
    },
  },

  [PhoebusWidgetType.TEXT_SYMBOL]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
    },
  },

  // Plots

  [PhoebusWidgetType.XY_PLOT]: {
    weissName: "GraphXY",
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
      // pvNames, lineColors are deferred for now.
    },
  },

  [PhoebusWidgetType.STRIP_CHART]: {
    weissName: "GraphY",
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
      [PhoebusProperty.TRACES]: "pvNames",
    },
  },

  [PhoebusWidgetType.DATA_BROWSER]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
    },
  },

  [PhoebusWidgetType.WATERFALL_PLOT]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
    },
  },

  // Containers

  [PhoebusWidgetType.GROUP]: {
    weissName: "Group",
    propMap: {
      [PhoebusProperty.X]: "x",
      [PhoebusProperty.Y]: "y",
      [PhoebusProperty.WIDTH]: "width",
      [PhoebusProperty.HEIGHT]: "height",
      // children are recursively converted by the parser, not via propMap
    },
  },

  [PhoebusWidgetType.TABS]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
    },
  },

  [PhoebusWidgetType.NAVIGATION_TABS]: {
    weissName: "NavigationTabs",
    hasFont: true,
    propMap: {
      ...COMMON_PROP_MAP,
      ...STYLE_PROP_MAP,
      [PhoebusProperty.FOREGROUND_COLOR]: "textColor",
      [PhoebusProperty.SELECTED_COLOR]: "activeTabColor",
      [PhoebusProperty.TABS]: "tabs",
    },
  },

  [PhoebusWidgetType.TEMPLATE]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
    },
  },

  [PhoebusWidgetType.EMBEDDED]: {
    weissName: "EmbeddedDisplay",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.FILE]: "displayPath",
      [PhoebusProperty.MACROS]: "macros",
    },
  },

  // Misc

  [PhoebusWidgetType.WEB_BROWSER]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
    },
  },

  [PhoebusWidgetType.VIEWER_3D]: {
    weissName: undefined,
    propMap: {
      ...COMMON_PROP_MAP,
    },
  },
};
