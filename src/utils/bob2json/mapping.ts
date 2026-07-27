// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

/**
 * Phoebus → WEISS widget and property mapping.
 *
 * Each entry in WIDGET_MAP declares:
 *   - weissName:   the WEISS widgetName registry key
 *   - propMap:     Phoebus property key → WEISS editableProperties key
 *
 * Properties not listed in propMap are silently dropped during conversion.
 * Properties that require transformation (e.g. color, font) are handled by
 * dedicated transform functions in the parser — the map only covers
 * direct string/number/boolean pass-throughs.
 */

import { PhoebusProperty, PhoebusWidgetType } from "./constants";

/* -------------------------------------------------------------------------- */
/* Property key mapping                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Maps a Phoebus property name to the corresponding WEISS editableProperties key.
 * Only covers properties that transfer directly as scalar values.
 */
export type WeissPropertyKey = string;

export type PropertyMap = Partial<Record<PhoebusProperty, WeissPropertyKey>>;

/**
 * Properties shared by virtually every widget on both sides.
 * Spread this into every entry's propMap and override where needed.
 */
const COMMON_PROP_MAP: PropertyMap = {
  [PhoebusProperty.X]: "x",
  [PhoebusProperty.Y]: "y",
  [PhoebusProperty.WIDTH]: "width",
  [PhoebusProperty.HEIGHT]: "height",
  [PhoebusProperty.TOOLTIP]: "tooltip",
  [PhoebusProperty.VISIBLE]: "visible",
  [PhoebusProperty.BORDER_WIDTH]: "borderWidth",
  [PhoebusProperty.BORDER_COLOR]: "borderColor", // value is a PhoebusColor — parser must transform
  [PhoebusProperty.BACKGROUND_COLOR]: "backgroundColor", // same
};

/**
 * Text/font-related properties shared by label, text_update, text_entry, buttons …
 * WEISS splits the Phoebus <font> element into individual scalar properties,
 * so FONT itself is NOT in this map — the parser handles it via a font transform.
 */
const TEXT_PROP_MAP: PropertyMap = {
  [PhoebusProperty.FOREGROUND_COLOR]: "textColor", // parser must transform color
  [PhoebusProperty.HORIZONTAL_ALIGNMENT]: "textHAlign", // parser must remap enum value
  [PhoebusProperty.VERTICAL_ALIGNMENT]: "textVAlign", // parser must remap enum value
};

/* -------------------------------------------------------------------------- */
/* Widget map entry                                                            */
/* -------------------------------------------------------------------------- */

export interface WidgetMapEntry {
  /** WEISS widgetName registry key (must match a registered WidgetDefinition). */
  weissName: string;
  /**
   * Phoebus property → WEISS editableProperties key.
   * Color and font properties listed here signal to the parser that a transform
   * is needed; the map value is still the target WEISS key.
   */
  propMap: PropertyMap;
}

/* -------------------------------------------------------------------------- */
/* Widget map                                                                  */
/* -------------------------------------------------------------------------- */

export const WIDGET_MAP: Partial<Record<PhoebusWidgetType, WidgetMapEntry>> = {
  /* ── Display / Text ──────────────────────────────────────────────────── */

  [PhoebusWidgetType.LABEL]: {
    weissName: "Label",
    propMap: {
      ...COMMON_PROP_MAP,
      ...TEXT_PROP_MAP,
      [PhoebusProperty.TEXT]: "text",
      [PhoebusProperty.TRANSPARENT]: "transparent",
    },
  },

  [PhoebusWidgetType.TEXT_UPDATE]: {
    weissName: "TextUpdate",
    propMap: {
      ...COMMON_PROP_MAP,
      ...TEXT_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
    },
  },

  [PhoebusWidgetType.TEXT_ENTRY]: {
    weissName: "TextEntry",
    propMap: {
      ...COMMON_PROP_MAP,
      ...TEXT_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.ENABLED]: "enabled",
    },
  },

  /* ── Monitors ────────────────────────────────────────────────────────── */

  [PhoebusWidgetType.LED]: {
    weissName: "LED",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
    },
  },

  [PhoebusWidgetType.BYTE_MONITOR]: {
    weissName: "ByteMonitor",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
    },
  },

  [PhoebusWidgetType.PROGRESS_BAR]: {
    weissName: "ProgressBar",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.FOREGROUND_COLOR]: "barColor", // parser must transform color
    },
  },

  [PhoebusWidgetType.METER]: {
    weissName: "Meter",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
    },
  },

  [PhoebusWidgetType.LINEAR_METER]: {
    weissName: "LinearMeter",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
    },
  },

  [PhoebusWidgetType.TANK]: {
    weissName: "Tank",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
    },
  },

  [PhoebusWidgetType.THERMOMETER]: {
    weissName: "Thermometer",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
    },
  },

  [PhoebusWidgetType.SYMBOL]: {
    weissName: "Symbol",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
    },
  },

  /* ── Controls ────────────────────────────────────────────────────────── */

  [PhoebusWidgetType.ACTION_BUTTON]: {
    weissName: "ActionButton",
    propMap: {
      ...COMMON_PROP_MAP,
      ...TEXT_PROP_MAP,
      [PhoebusProperty.TEXT]: "text",
      [PhoebusProperty.ENABLED]: "enabled",
      // ACTIONS is a structured element — handled separately by the parser
    },
  },

  [PhoebusWidgetType.BOOLEAN_BUTTON]: {
    weissName: "BoolButton",
    propMap: {
      ...COMMON_PROP_MAP,
      ...TEXT_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.ENABLED]: "enabled",
    },
  },

  [PhoebusWidgetType.CHECK_BOX]: {
    weissName: "CheckBox",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.TEXT]: "text",
      [PhoebusProperty.ENABLED]: "enabled",
    },
  },

  [PhoebusWidgetType.COMBO_BOX]: {
    weissName: "ComboBox",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.ENABLED]: "enabled",
    },
  },

  [PhoebusWidgetType.CHOICE_BUTTON]: {
    weissName: "ChoiceButton",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.ENABLED]: "enabled",
    },
  },

  [PhoebusWidgetType.SCALED_SLIDER]: {
    weissName: "Slider",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.ENABLED]: "enabled",
    },
  },

  [PhoebusWidgetType.SCROLL_BAR]: {
    weissName: "ScrollBar",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.PV_NAME]: "pvName",
      [PhoebusProperty.ENABLED]: "enabled",
    },
  },

  /* ── Graphics ────────────────────────────────────────────────────────── */

  [PhoebusWidgetType.RECTANGLE]: {
    weissName: "Rectangle",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.FOREGROUND_COLOR]: "borderColor", // parser must transform color
      [PhoebusProperty.TRANSPARENT]: "transparent",
    },
  },

  [PhoebusWidgetType.ELLIPSE]: {
    weissName: "Ellipse",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.FOREGROUND_COLOR]: "borderColor",
      [PhoebusProperty.TRANSPARENT]: "transparent",
    },
  },

  [PhoebusWidgetType.ARC]: {
    weissName: "Arc",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.FOREGROUND_COLOR]: "borderColor",
      [PhoebusProperty.TRANSPARENT]: "transparent",
    },
  },

  [PhoebusWidgetType.PICTURE]: {
    weissName: "Picture",
    propMap: {
      ...COMMON_PROP_MAP,
    },
  },

  /* ── Plots ───────────────────────────────────────────────────────────── */

  [PhoebusWidgetType.XY_PLOT]: {
    weissName: "XYPlot",
    propMap: {
      ...COMMON_PROP_MAP,
      // pvNames, lineColors — structured, handled by parser
    },
  },

  [PhoebusWidgetType.STRIP_CHART]: {
    weissName: "StripChart",
    propMap: {
      ...COMMON_PROP_MAP,
      // pvNames, lineColors — structured, handled by parser
    },
  },

  [PhoebusWidgetType.DATA_BROWSER]: {
    weissName: "DataBrowser",
    propMap: {
      ...COMMON_PROP_MAP,
    },
  },

  /* ── Containers ──────────────────────────────────────────────────────── */

  [PhoebusWidgetType.GROUP]: {
    weissName: "Group",
    propMap: {
      ...COMMON_PROP_MAP,
      [PhoebusProperty.STYLE]: "groupStyle",
      // children are recursively converted by the parser, not via propMap
    },
  },

  [PhoebusWidgetType.TABS]: {
    weissName: "Tabs",
    propMap: {
      ...COMMON_PROP_MAP,
      // tab children are recursively converted by the parser
    },
  },

  [PhoebusWidgetType.NAVIGATION_TABS]: {
    weissName: "NavigationTabs",
    propMap: {
      ...COMMON_PROP_MAP,
    },
  },

  [PhoebusWidgetType.TEMPLATE]: {
    weissName: "EmbeddedDisplay",
    propMap: {
      ...COMMON_PROP_MAP,
    },
  },
};
