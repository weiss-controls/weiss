// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

/**
 * Constants used by the Phoebus XML parser and converter.
 */

// XML elements

export const PhoebusElement = {
  DISPLAY: "display",
  WIDGET: "widget",
  NAME: "name",
  TYPE: "type",

  // color
  COLOR: "color",

  // points (polygon, polyline)
  POINTS: "points",
  POINT: "point",

  // items (choice, radio)
  ITEMS: "items",
  ITEM: "item",

  // table columns
  COLUMNS: "columns",
  COLUMN: "column",

  // multi_state_led states
  STATES: "states",
  STATE: "state",
  VALUE: "value",
  LABEL: "label",

  // tabs container
  TABS: "tabs",
  TAB: "tab",
  CHILDREN: "children",
} as const;

// XML attributes

export const PhoebusAttribute = {
  VERSION: "version",
  TYPE: "type",
  NAME: "name",

  // color attrs
  RED: "red",
  GREEN: "green",
  BLUE: "blue",
  ALPHA: "alpha",

  // point attrs (note: point x/y are attributes, unlike widget x/y which are elements)
  X: "x",
  Y: "y",

  // column attrs
  EDITABLE: "editable",
  WIDTH: "width",

  // font attrs
  FAMILY: "family",
  SIZE: "size",
  STYLE: "style",
} as const;

// Common widget properties

export const PhoebusProperty = {
  NAME: "name",

  X: "x",
  Y: "y",

  WIDTH: "width",
  HEIGHT: "height",

  ROTATION: "rotation",
  HORIZONTAL: "horizontal",
  NBITS: "numBits",

  VISIBLE: "visible",
  ENABLED: "enabled",

  OPACITY: "opacity",

  BACKGROUND_COLOR: "background_color",
  FOREGROUND_COLOR: "foreground_color",

  FONT: "font",

  HORIZONTAL_ALIGNMENT: "horizontal_alignment",
  VERTICAL_ALIGNMENT: "vertical_alignment",

  BORDER_WIDTH: "border_width",
  BORDER_COLOR: "border_color",

  ON_COLOR: "on_color",
  OFF_COLOR: "off_color",
  LINE_COLOR: "line_color",
  LINE_WIDTH: "line_width",
  LINE_STYLE: "line_style",
  ON_LABEL: "on_label",
  OFF_LABEL: "off_label",
  SELECTED_COLOR: "selected_color",

  TRANSPARENT: "transparent",
  SQUARE: "square",

  TEXT: "text",
  FILE: "file",

  PV_NAME: "pv_name",
  MACROS: "macros",
  GRID_COLOR: "grid_color",
  GRID_VISIBLE: "grid_visible",
  GRID_STEP_X: "grid_step_x",
  GRID_STEP_Y: "grid_step_y",

  TOOLTIP: "tooltip",

  RULES: "rules",
  ACTIONS: "actions",
  SCRIPTS: "scripts",

  STYLE: "style",

  // structural
  POINTS: "points",
  ITEMS: "items",
  COLUMNS: "columns",
  STATES: "states",
  TABS: "tabs",
} as const;

// Widget types

export const PhoebusWidgetType = {
  LABEL: "label",
  TEXT_UPDATE: "textupdate",
  TEXT_ENTRY: "textentry",
  ACTION_BUTTON: "action_button",
  LED: "led",
  MULTI_STATE_LED: "multi_state_led",
  BOOLEAN_BUTTON: "bool_button",
  CHECK_BOX: "checkbox",
  COMBO_BOX: "combo",
  CHOICE_BUTTON: "choice",
  BYTE_MONITOR: "byte_monitor",
  ARRAY: "array",
  METER: "meter",
  LINEAR_METER: "linearmeter",
  PROGRESS_BAR: "progressbar",
  SCROLL_BAR: "scrollbar",
  SCALED_SLIDER: "scaledslider",
  SLIDE_BUTTON: "slide_button",
  SPINNER: "spinner",
  THUMBWHEEL: "thumbwheel",
  TANK: "tank",
  THERMOMETER: "thermometer",
  RECTANGLE: "rectangle",
  ELLIPSE: "ellipse",
  ARC: "arc",
  POLYGON: "polygon",
  POLYLINE: "polyline",
  GROUP: "group",
  TABS: "tabs",
  EMBEDDED: "embedded",
  TEMPLATE: "template",
  NAVIGATION_TABS: "navtabs",
  PICTURE: "picture",
  SYMBOL: "symbol",
  TEXT_SYMBOL: "text-symbol",
  TABLE: "table",
  FILE_SELECTOR: "fileselector",
  RADIO_BUTTON: "radio",
  IMAGE: "image",
  XY_PLOT: "xyplot",
  STRIP_CHART: "stripchart",
  DATA_BROWSER: "databrowser",
  WATERFALL_PLOT: "waterfallplotwidget",
  WEB_BROWSER: "webbrowser",
  VIEWER_3D: "3dviewer",
} as const;

// Enumerations

export const PhoebusAlignment = {
  LEFT: "LEFT",
  CENTER: "CENTER",
  RIGHT: "RIGHT",
  TOP: "TOP",
  MIDDLE: "MIDDLE",
  BOTTOM: "BOTTOM",
} as const;

export const PhoebusBoolean = {
  TRUE: "true",
  FALSE: "false",
} as const;

export const COLOR_PROP_KEYS = new Set<PhoebusProperty>([
  PhoebusProperty.BACKGROUND_COLOR,
  PhoebusProperty.FOREGROUND_COLOR,
  PhoebusProperty.BORDER_COLOR,
  PhoebusProperty.ON_COLOR,
  PhoebusProperty.OFF_COLOR,
  PhoebusProperty.LINE_COLOR,
  PhoebusProperty.SELECTED_COLOR,
]);

// Type aliases

export type PhoebusWidgetType = (typeof PhoebusWidgetType)[keyof typeof PhoebusWidgetType];
export type PhoebusProperty = (typeof PhoebusProperty)[keyof typeof PhoebusProperty];
export type PhoebusAlignment = (typeof PhoebusAlignment)[keyof typeof PhoebusAlignment];
