// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { SvgIconProps } from "@mui/material/SvgIcon";
import { PROPERTY_SCHEMAS } from "./widgetProperties";
import type { MultiPvData, PVData } from "./epicsWS";

/**
 * Selector types for widget properties.
 * Possible values:
 * - "text": text input
 * - "number": numeric input
 * - "boolean": checkbox
 * - "colorSel": color picker
 * - "colorSelList": list of color pickers
 * - "select": dropdown selection
 * - "strList": list of string entries
 * - "strRecord": string-string record (key-value pairs)
 * - "none": no selector (property not displayed)
 */
export type PropertySelectorType =
  | "text"
  | "number"
  | "boolean"
  | "colorSel"
  | "colorSelList"
  | "select"
  | "strList"
  | "strRecord"
  | "none";

/** Allowed values for a widget property */
export type PropertyValue = string | number | boolean | string[] | Record<string, string>;

/** Format of numerical limits for a property */
export interface PropertyLimits {
  min?: number;
  max?: number;
}

/**
 * Represents a single widget property.
 * @template T Type of the property value
 * @property selType Type of input selector for this property
 * @property label Label to display in the UI
 * @property value Current or default value of the property
 * @property category Category of the property for grouping in the editor
 * @property options Optional list of string options (used for dropdown/select)
 * @property limits Optional min and max numerical limits
 */
export interface WidgetProperty<T extends PropertyValue = PropertyValue> {
  selType: PropertySelectorType;
  label: string;
  value: T;
  category: string;
  options?: string[];
  limits?: PropertyLimits;
}

/** Keys of the PROPERTY_SCHEMAS object */
export type PropertyKey = keyof typeof PROPERTY_SCHEMAS;

/** Partial subset of all widget properties */
export type WidgetProperties = Partial<typeof PROPERTY_SCHEMAS>;

/**
 * Updates to a single widget's properties.
 * @property [propertyKey: PropertyKey] New value for each widget property
 * Example:
 * ```ts
 * const updates: PropertyUpdates = { label: "New Label", visible: true };
 * ```
 */
export type PropertyUpdates = Partial<Record<PropertyKey, PropertyValue>>;

/**
 * Updates for multiple widgets.
 * @property [widgetId: string] Set of property updates for that widget
 * Example:
 * ```ts
 * const multiUpdates: MultiWidgetPropertyUpdates = {
 *   "widget1": { label: "Updated", height: 40 },
 *   "widget2": { backgroundColor: "#00ff00" }
 * };
 * ```
 */
export type MultiWidgetPropertyUpdates = Record<string, PropertyUpdates>;

/**
 * Wrapper for a widget update event.
 * @property data The widget being updated
 */
export interface WidgetUpdate {
  data: Widget;
}

/** Type alias for a MUI icon component used as a widget icon */
export type WidgetIconType = React.FC<SvgIconProps>;

/**
 * Represents a widget definition in the editor.
 * @property id Unique identifier for the widget instance
 * @property widgetLabel Label to display in the UI
 * @property widgetIcon Optional icon component
 * @property pvData Optional current PV data
 * @property multiPvData Optional PV data for multiple PVs
 * @property widgetName Internal widget name
 * @property component React component used to render the widget
 * @property category Category of the widget (for grouping in UI)
 * @property editableProperties Editable properties of the widget
 */
export interface Widget {
  id: string;
  widgetLabel: string;
  widgetIcon?: WidgetIconType;
  pvData?: PVData;
  multiPvData?: MultiPvData;
  children?: Widget[];
  widgetName: string;
  component: React.FC<WidgetUpdate>;
  category: string;
  editableProperties: WidgetProperties;
}

/**
 * Simplified representation of a widget for export.
 * @property id Widget ID
 * @property widgetName Widget name
 * @property properties Partial properties of the widget
 */
export interface ExportedWidget {
  id: string;
  children?: ExportedWidget[];
  widgetName: string;
  properties: Partial<Record<PropertyKey, PropertyValue>>;
}

/**
 * Represents the position of a widget on a grid layout.
 * @property x X coordinate on the grid
 * @property y Y coordinate on the grid
 */
export interface GridPosition {
  x: number;
  y: number;
}

/**
 * Represents the position and dimensions of a Rectangle on the grid.
 * @property x X coordinate on the grid
 * @property y Y coordinate on the grid
 * @property width width of the rectangle
 * @property height height of the rectangle
 */
export interface DOMRectLike extends GridPosition {
  width: number;
  height: number;
}
