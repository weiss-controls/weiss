// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import {
  type WidgetProperty,
  type PropertyValue,
  type WidgetProperties,
  type ValueDisplayFormat,
  type StateEntry,
  valueDisplayFormats,
} from "./widgets";
import { COLORS } from "@src/constants/constants";

/**
 * Helper function to enforce proper typing of widget properties.
 * Returns the property object as-is but ensures TypeScript infers the correct type.
 * @param prop - A WidgetProperty object
 * @returns The same WidgetProperty object with type enforcement
 */
function defineProp<T extends PropertyValue>(prop: WidgetProperty<T>): WidgetProperty<T> {
  return prop;
}

/**
 * Master schema of all widget properties.
 * Standardizes widget property definitions across the app.
 */
/* prettier-ignore */
export const PROPERTY_SCHEMAS = {
  disabled:        defineProp({ selType: "boolean", label: "Disabled", value: false as boolean, category: "General" }),
  macros:          defineProp({ selType: "strRecord", label: "Macro", value: {} as Record<string, string>, category: "EPICS" }),
  globalMacros:    defineProp({ selType: "strRecord", label: "Global Macros", value: {} as Record<string, string>, category: "EPICS" }),
  rules:           defineProp({ selType: "none", label: "Rules", value: {} as Record<string, string>, category: "EPICS" }),
  // Layout
  alias:           defineProp({ selType: "text", label: "Widget alias", value: "" as string, category: "Layout" }),
  x:               defineProp({ selType: "number", label: "X", value: 100 as number, category: "Layout" }),
  y:               defineProp({ selType: "number", label: "Y", value: 100 as number, category: "Layout" }),
  width:           defineProp({ selType: "number", label: "Width", value: 100 as number, limits: { min: 1 }, category: "Layout" }),
  height:          defineProp({ selType: "number", label: "Height", value: 40 as number, limits: { min: 1 }, category: "Layout" }),
  label:           defineProp({ selType: "text", label: "Label", value: "" as string, category: "Text" }),  
  tooltip:         defineProp({ selType: "text", label: "Tooltip", value: "$(pvname) - $(pvdesc)" as string, category: "Text" }),
  visible:         defineProp({ selType: "none", label: "Visible", value: true as boolean, category: "Layout" }),
  displayFormat:   defineProp({ selType: "select", label: "Display Format", value: "Default" as ValueDisplayFormat, options: [...valueDisplayFormats], category: "Layout" }),
  // Style
  backgroundColor: defineProp({ selType: "colorSel", label: "Background Color", value: COLORS.backgroundColor, category: "Style" }),
  borderColor:     defineProp({ selType: "colorSel", label: "Border Color", value: COLORS.textColor, category: "Style" }),
  borderWidth:     defineProp({ selType: "number", label: "Border Width", value: 1 as number, limits: { min: 0 }, category: "Style" }),
  borderRadius:    defineProp({ selType: "number", label: "Border Radius", value: 2 as number, limits: { min: 0 }, category: "Style" }),
  borderStyle:     defineProp({ selType: "select", label: "Border Style", value: "none" as string, options: ["solid", "dashed", "dotted", "none"], category: "Style" }),
  // Font
  textColor:       defineProp({ selType: "colorSel", label: "Text Color", value: COLORS.textColor, category: "Text" }),
  fontSize:        defineProp({ selType: "number", label: "Font Size", value: 14 as number, limits: { min: 1 }, category: "Text" }),
  fontFamily:      defineProp({ selType: "select", label: "Font Family", value: "sans-serif" as string, options: ["serif", "sans-serif", "monospace", "fantasy", "cursive"], category: "Text" }),
  fontBold:        defineProp({ selType: "boolean", label: "Bold text", value: false as boolean, category: "Text" }),
  fontItalic:      defineProp({ selType: "boolean", label: "Italic text", value: false as boolean, category: "Text" }),
  fontUnderlined:  defineProp({ selType: "boolean", label: "Underlined text", value: false as boolean, category: "Text" }),
  textHAlign:      defineProp({ selType: "select", label: "Horizontal Align", value: "left" as string, options: ["left", "center", "right"], category: "Text" }),
  textVAlign:      defineProp({ selType: "select", label: "Vert. Align", value: "middle" as string, options: ["top", "middle", "bottom"], category: "Text" }),
  // Grid options
  gridLineColor:   defineProp({ selType: "colorSel", label: "Grid Line Color", value: COLORS.gridLineColor, category: "Style" }),
  gridLineVisible: defineProp({ selType: "boolean", label: "Grid Visible", value: true as boolean, category: "Grid" }),
  gridSize:        defineProp({ selType: "number", label: "Grid Size", value: 10 as number, limits: { min: 1 }, category: "Grid" }),
  snapToGrid:      defineProp({ selType: "boolean", label: "Snap items", value: true as boolean, category: "Grid" }),
  centerVisible:   defineProp({ selType: "boolean", label: "Center mark visible", value: true as boolean, category: "Grid" }),
  guidesVisible:   defineProp({ selType: "boolean", label: "Drag guides visible", value: true as boolean, category: "Grid" }),
  // EPICS
  pvName:          defineProp({ selType: "text", label: "PV Name", value: "" as string, category: "EPICS" }),
  pvNames:         defineProp({ selType: "strList", label: "PV Name", value: [] as string[], category: "EPICS" }),
  precisionFromPV: defineProp({ selType: "boolean", label: "Precision from PV", value: true as boolean, category: "EPICS" }),
  precision:       defineProp({ selType: "number", label: "Precision", value: -1 as number, limits: { min: -1 }, category: "EPICS" }),
  unitsFromPV:     defineProp({ selType: "boolean", label: "Units from PV", value: true as boolean, category: "EPICS" }),
  units:           defineProp({ selType: "text", label: "Units", value: "" as string, category: "EPICS" }),
  alarmBorder:     defineProp({ selType: "boolean", label: "Alarm border", value: true as boolean, category: "EPICS" }),
  labelFromPV:     defineProp({ selType: "boolean", label: "Label(s) from PV", value: false as boolean, category: "EPICS" }),
  actionValue:     defineProp({ selType: "text", label: "Action Value", value: 1 as number | string, category: "EPICS" }),
  // BitIndicators
  horizontal:      defineProp({ selType: "boolean", label: "Horizontal", value: false, category: "Layout" }),
  nBits:           defineProp({ selType: "number", label: "Number of bits", value: 8 as number, limits: { min: 1 }, category: "Layout" }),
  invertBitOrder:  defineProp({ selType: "boolean", label: "Invert bit order", value: false as boolean, category: "Layout" }),
  onColor:         defineProp({ selType: "colorSel", label: "On Color", value: COLORS.onColor, category: "Style" }),
  offColor:        defineProp({ selType: "colorSel", label: "Off Color", value: COLORS.offColor, category: "Style" }),
  spacing:         defineProp({ selType: "number", label: "Spacing", value: 1 as number, limits: { min: 0 }, category: "Style" }),
  square:          defineProp({ selType: "boolean", label: "Square", value: false as boolean, category: "Style" }),
  fixedProportion: defineProp({ selType: "boolean", label: "Fixed proportion", value: true as boolean, category: "Style" }),
  useStringVal:    defineProp({ selType: "boolean", label: "Use string value", value: true as boolean, category: "EPICS" }),
  offLabel:        defineProp({ selType: "text", label: "Off label", value: "" as string, category: "Text" }),
  onLabel:         defineProp({ selType: "text", label: "On label", value: "" as string, category: "Text" }),
  // Plots
  lineColors:      defineProp({ selType: "colorSelList", label: "Line Color", value: [COLORS.graphLineColor] as string[], category: "Style" }),
  plotTitle:       defineProp({ selType: "text", label: "Title", value: "Title" as string, category: "Text" }),
  xAxisTitle:      defineProp({ selType: "text", label: "X axis title", value: "X axis" as string, category: "Text" }),
  yAxisTitle:      defineProp({ selType: "text", label: "Y axis title", value: "Y axis" as string, category: "Text" }),
  logscaleY:       defineProp({ selType: "boolean", label: "Apply log to Y", value: false as boolean, category: "Layout" }),
  showLegend:      defineProp({ selType: "boolean", label: "Show legend", value: true as boolean, category: "Layout" }),
  useTimestamp:    defineProp({ selType: "boolean", label: "Use timestamp", value: false as boolean, category: "Layout" }),
  plotBufferSize:  defineProp({ selType: "number", label: "Buffer size (non-array PVs)", value: 80 as number, limits: { min: 1 }, category: "Layout" }),
  plotLineStyle:   defineProp({ selType: "select", label: "Line style", value: "lines" as "lines+markers"|"lines"|"markers", options: ["lines+markers", "lines", "markers"], category: "Style" }),
  legendOrient:    defineProp({ selType: "select", label: "Legend orientation", value: "horizontal" as string, options: ["horizontal", "vertical"], category: "Layout" }),
  legendVAlign:    defineProp({ selType: "select", label: "Legend vertical align", value: "top" as string, options: ["top", "middle", "bottom"], category: "Layout" }),
  legendHAlign:    defineProp({ selType: "select", label: "Legend horizontal align", value: "right" as string, options: ["left", "center", "right"], category: "Layout" }),
  // Selector
  enumChoices:     defineProp({ selType: "strList", label: "Option label", value: [""] as string[], category: "EPICS" }),
  // Slider
  stepSize:        defineProp({ selType: "number", label: "Step Size", value: 0 as number, limits: { min: 1 }, category: "Layout" }),
  min:             defineProp({ selType: "number", label: "Minimum value", value: 0 as number, category: "EPICS" }),
  max:             defineProp({ selType: "number", label: "Maximum value", value: 0 as number, category: "EPICS" }),
  //Other
  valuePlcmnt:     defineProp({ selType: "select", label: "Value placement", value: "top" as string, options: ["top", "bottom", "end", "start", "middle"], category: "Layout" }),
  labelPlcmnt:     defineProp({ selType: "select", label: "Label placement", value: "end" as string, options: ["top", "bottom", "end", "start", "middle"], category: "Layout" }),
  limitsFromPV:    defineProp({ selType: "boolean", label: "Limits From PV", value: true as boolean, category: "EPICS" }),
  // ProgressBar
  showValue:       defineProp({ selType: "boolean", label: "Show Value", value: true as boolean, category: "Text" }),
  showPercentage:  defineProp({ selType: "boolean", label: "Show Percentage", value: false as boolean, category: "Text" }),
  barColor:        defineProp({ selType: "colorSel", label: "Bar Color", value: COLORS.midDarkBlue, category: "Style" }),
  // Image
  imagePath:       defineProp({ selType: "repoFile", label: "Image path", value: "" as string, category: "General", options: [".svg", ".png", ".jpg", ".jpeg"] }),
  keepAspectRatio: defineProp({ selType: "boolean", label: "Keep aspect ratio", value: true as boolean, category: "Style" }),
  // EmbeddedDisplay and NavigationButton
  displayPath:      defineProp({ selType: "repoFile", label: "Display path", value: "" as string, category: "General", options: [".opi.json"] }),
  target:           defineProp({ selType: "text", label: "Target", value: "" as string, category: "General" }),
  // MultiStateLED
  stateList:       defineProp({ selType: "stateList", label: "States", value: [{ value: "0", color: COLORS.offColor, label: "" }, { value: "1", color: COLORS.onColor, label: "" }, { value: "", color: COLORS.midGray, label: "" }] as StateEntry[], category: "EPICS" }),
};

/**
 * Defines the preferred order for displaying property categories in the UI.
 */
export const CATEGORY_DISPLAY_ORDER = [
  "EPICS",
  "Grid",
  "Layout",
  "Text",
  "Style",
  "General",
  "Other",
];

/**
 * Common set of widget properties shared across most widgets.
 */
export const COMMON_PROPS: WidgetProperties = {
  alias: PROPERTY_SCHEMAS.alias,
  x: PROPERTY_SCHEMAS.x,
  y: PROPERTY_SCHEMAS.y,
  width: PROPERTY_SCHEMAS.width,
  height: PROPERTY_SCHEMAS.height,
  backgroundColor: PROPERTY_SCHEMAS.backgroundColor,
  borderColor: PROPERTY_SCHEMAS.borderColor,
  borderStyle: PROPERTY_SCHEMAS.borderStyle,
  borderWidth: PROPERTY_SCHEMAS.borderWidth,
  borderRadius: PROPERTY_SCHEMAS.borderRadius,
  visible: PROPERTY_SCHEMAS.visible,
  tooltip: PROPERTY_SCHEMAS.tooltip,
  alarmBorder: PROPERTY_SCHEMAS.alarmBorder,
};

/**
 * Common text-related properties for widgets displaying text.
 */
export const TEXT_PROPS: WidgetProperties = {
  fontFamily: PROPERTY_SCHEMAS.fontFamily,
  fontSize: PROPERTY_SCHEMAS.fontSize,
  textHAlign: PROPERTY_SCHEMAS.textHAlign,
  textVAlign: PROPERTY_SCHEMAS.textVAlign,
  fontBold: PROPERTY_SCHEMAS.fontBold,
  textColor: PROPERTY_SCHEMAS.textColor,
  fontItalic: PROPERTY_SCHEMAS.fontItalic,
  fontUnderlined: PROPERTY_SCHEMAS.fontUnderlined,
};

/**
 * Properties commonly used for plot widgets.
 */
export const PLOT_PROPS: WidgetProperties = {
  pvNames: PROPERTY_SCHEMAS.pvNames,
  backgroundColor: { ...PROPERTY_SCHEMAS.backgroundColor, value: "white" },
  lineColors: PROPERTY_SCHEMAS.lineColors,
  plotTitle: PROPERTY_SCHEMAS.plotTitle,
  xAxisTitle: PROPERTY_SCHEMAS.xAxisTitle,
  yAxisTitle: PROPERTY_SCHEMAS.yAxisTitle,
  logscaleY: PROPERTY_SCHEMAS.logscaleY,
  plotBufferSize: PROPERTY_SCHEMAS.plotBufferSize,
  plotLineStyle: PROPERTY_SCHEMAS.plotLineStyle,
  showLegend: PROPERTY_SCHEMAS.showLegend,
  legendOrient: PROPERTY_SCHEMAS.legendOrient,
  legendVAlign: PROPERTY_SCHEMAS.legendVAlign,
  legendHAlign: PROPERTY_SCHEMAS.legendHAlign,
};
