// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { PhoebusProperty, PhoebusWidgetType } from "./constants";

// Parsed value types

export interface PhoebusColor {
  name?: string;
  red: number;
  green: number;
  blue: number;
  alpha?: number;
}

export interface PhoebusFont {
  family?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
}

export interface PhoebusState {
  value: number;
  label: string;
  color?: PhoebusColor;
}

/** A single <tab> entry of a navtabs widget: display name, linked file, and its own macros. */
export interface PhoebusNavTab {
  name: string;
  file?: string;
  macros?: Record<string, string>;
}

/** A single <trace> entry of an xyplot/stripchart widget: monitored PV and line color. */
export interface PhoebusTrace {
  yPv?: string;
  color?: PhoebusColor;
}

export type ColorWrapperProperty =
  | typeof PhoebusProperty.BACKGROUND_COLOR
  | typeof PhoebusProperty.FOREGROUND_COLOR
  | typeof PhoebusProperty.BORDER_COLOR
  | typeof PhoebusProperty.ON_COLOR
  | typeof PhoebusProperty.OFF_COLOR
  | typeof PhoebusProperty.LINE_COLOR
  | typeof PhoebusProperty.SELECTED_COLOR;

// Phoebus IR

export interface PhoebusWidget {
  type: PhoebusWidgetType;
  name?: string;
  properties: Map<PhoebusProperty, unknown>;
  children: PhoebusWidget[];
}

export interface PhoebusDisplay {
  version?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  macros?: Record<string, string>;
  backgroundColor?: PhoebusColor;
  gridColor?: PhoebusColor;
  gridVisible?: boolean | string | number;
  gridStepX?: number;
  gridStepY?: number;
  widgets: PhoebusWidget[];
}

// Widget mapping types

/** Maps a Phoebus property name to the corresponding WEISS editableProperties key. */
export type PropertyMap = Partial<Record<PhoebusProperty, string>>;

export interface WidgetMapEntry {
  /** WEISS widgetName registry key (undefined if no corresponding widget exists). */
  weissName: string | undefined;
  /** Phoebus property -> WEISS editableProperties key. */
  propMap: PropertyMap;
  /**
   * When true, the widget's <font> property is extracted and spread into individual
   * WEISS font keys (fontFamily, fontSize, fontBold, fontItalic).
   * FONT is intentionally absent from propMap; this flag drives the converter.
   */
  hasFont?: boolean;
}
