/**
 * Phoebus Display Builder XML definitions.
 */

/* -------------------------------------------------------------------------- */
/* XML Elements                                                               */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* XML Attributes                                                             */
/* -------------------------------------------------------------------------- */

export const PhoebusAttribute = {
  VERSION: "version",
  TYPE: "type",
  NAME: "name",

  // color attrs
  RED: "red",
  GREEN: "green",
  BLUE: "blue",

  // point attrs (note: point x/y are attributes, unlike widget x/y which are elements)
  X: "x",
  Y: "y",

  // column attrs
  EDITABLE: "editable",
  WIDTH: "width",
} as const;

/* -------------------------------------------------------------------------- */
/* Common Widget Properties                                                   */
/* -------------------------------------------------------------------------- */

export const PhoebusProperty = {
  NAME: "name",

  X: "x",
  Y: "y",

  WIDTH: "width",
  HEIGHT: "height",

  ROTATION: "rotation",

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

  TRANSPARENT: "transparent",

  TEXT: "text",

  PV_NAME: "pv_name",

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

/* -------------------------------------------------------------------------- */
/* Widget Types                                                               */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Enumerations                                                               */
/* -------------------------------------------------------------------------- */

export const PhoebusAlignment = {
  LEFT: "LEFT",
  CENTRE: "CENTER",
  RIGHT: "RIGHT",
  TOP: "TOP",
  BOTTOM: "BOTTOM",
} as const;

export const PhoebusBoolean = {
  TRUE: "true",
  FALSE: "false",
} as const;

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type PhoebusWidgetType = (typeof PhoebusWidgetType)[keyof typeof PhoebusWidgetType];
export type PhoebusProperty = (typeof PhoebusProperty)[keyof typeof PhoebusProperty];
export type PhoebusAlignment = (typeof PhoebusAlignment)[keyof typeof PhoebusAlignment];
