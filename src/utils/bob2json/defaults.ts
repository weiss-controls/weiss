// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

/**
 * Phoebus widget default property values.
 *
 * Phoebus omits properties from the XML when they match the application's
 * built-in defaults. As those defaults are discovered they are recorded here
 * so the converter can fill them in, producing correct WEISS output even when
 * the XML is silent.
 *
 * Structure per widget type:
 *   inputDefaults  - written into the Phoebus property map before the propMap
 *                    loop runs; only applied when the key is absent in the XML.
 *   outputDefaults - WEISS-side properties written directly into the output
 *                    after the propMap loop; used for derived or WEISS-only
 *                    defaults that have no Phoebus property counterpart.
 */

import { PhoebusProperty, PhoebusWidgetType } from "./constants";
import type { PhoebusColor, PhoebusState, PhoebusWidget } from "./types";
import type { PropertyValue } from "@src/types/widgets";

export interface PhoebusWidgetDefaultsEntry {
  /**
   * Defaults injected into `phWidget.properties` before conversion.
   * Each key is only set when the property is absent from the parsed XML.
   */
  inputDefaults?: Partial<Record<PhoebusProperty, unknown>>;

  /**
   * Defaults written into the WEISS output properties after the propMap loop.
   * These are WEISS-side keys (not Phoebus property names) and are always
   * applied unconditionally.
   */
  outputDefaults?: Record<string, PropertyValue>;
}

const PHOEBUS_DEFAULT_OFF_COLOR: PhoebusColor = {
  red: 60,
  green: 100,
  blue: 60,
};

const PHOEBUS_DEFAULT_ON_COLOR: PhoebusColor = {
  red: 60,
  green: 255,
  blue: 60,
};

const PHOEBUS_MULTI_STATE_LED_FALLBACK_COLOR: PhoebusColor = {
  red: 176,
  green: 118,
  blue: 255,
};

const PHOEBUS_MULTI_STATE_LED_DEFAULT_STATES: PhoebusState[] = [
  { value: 0, label: "", color: PHOEBUS_DEFAULT_OFF_COLOR },
  { value: 1, label: "", color: PHOEBUS_DEFAULT_ON_COLOR },
  { value: 2, label: "", color: PHOEBUS_MULTI_STATE_LED_FALLBACK_COLOR },
];

// Per-widget defaults

export const PHOEBUS_WIDGET_DEFAULTS: Partial<
  Record<PhoebusWidgetType, PhoebusWidgetDefaultsEntry>
> = {
  // Display / text

  [PhoebusWidgetType.LABEL]: {
    inputDefaults: {
      [PhoebusProperty.WIDTH]: 100,
      [PhoebusProperty.HEIGHT]: 20,
      // Transparency is handled as conditional logic in applyWidgetDefaults;
      // see comment there for why it cannot be a simple data entry.
    },
  },

  [PhoebusWidgetType.TEXT_UPDATE]: {
    inputDefaults: {
      [PhoebusProperty.WIDTH]: 100,
      [PhoebusProperty.HEIGHT]: 20,
    },
  },

  [PhoebusWidgetType.TEXT_ENTRY]: {
    inputDefaults: {
      [PhoebusProperty.WIDTH]: 100,
      [PhoebusProperty.HEIGHT]: 20,
    },
  },

  // Controls

  [PhoebusWidgetType.ACTION_BUTTON]: {
    inputDefaults: {
      [PhoebusProperty.WIDTH]: 100,
      [PhoebusProperty.HEIGHT]: 30,
    },
  },

  [PhoebusWidgetType.BOOLEAN_BUTTON]: {
    inputDefaults: {
      [PhoebusProperty.WIDTH]: 100,
      [PhoebusProperty.HEIGHT]: 30,
    },
  },

  [PhoebusWidgetType.COMBO_BOX]: {
    inputDefaults: {
      [PhoebusProperty.WIDTH]: 100,
      [PhoebusProperty.HEIGHT]: 30,
    },
  },

  [PhoebusWidgetType.SPINNER]: {
    inputDefaults: {
      [PhoebusProperty.WIDTH]: 100,
      [PhoebusProperty.HEIGHT]: 20,
    },
  },
  // Monitors

  [PhoebusWidgetType.LED]: {
    inputDefaults: {
      [PhoebusProperty.WIDTH]: 20,
      [PhoebusProperty.HEIGHT]: 20,
      [PhoebusProperty.OFF_COLOR]: PHOEBUS_DEFAULT_OFF_COLOR,
      [PhoebusProperty.ON_COLOR]: PHOEBUS_DEFAULT_ON_COLOR,
    },
    // fixedProportion is a WEISS-only concept with no Phoebus counterpart.
    outputDefaults: {
      fixedProportion: false,
    },
  },

  [PhoebusWidgetType.MULTI_STATE_LED]: {
    inputDefaults: {
      [PhoebusProperty.WIDTH]: 20,
      [PhoebusProperty.HEIGHT]: 20,
      [PhoebusProperty.STATES]: PHOEBUS_MULTI_STATE_LED_DEFAULT_STATES,
    },
  },

  [PhoebusWidgetType.PROGRESS_BAR]: {
    inputDefaults: {
      [PhoebusProperty.WIDTH]: 100,
      [PhoebusProperty.HEIGHT]: 20,
      // Phoebus progress bars are horizontal by default.
      [PhoebusProperty.HORIZONTAL]: true,
    },
  },

  [PhoebusWidgetType.BYTE_MONITOR]: {
    inputDefaults: {
      // Phoebus byte monitors are horizontal by default.
      [PhoebusProperty.HORIZONTAL]: true,
      [PhoebusProperty.OFF_COLOR]: PHOEBUS_DEFAULT_OFF_COLOR,
      [PhoebusProperty.ON_COLOR]: PHOEBUS_DEFAULT_ON_COLOR,
    },
  },

  // Graphics

  [PhoebusWidgetType.RECTANGLE]: {
    inputDefaults: {
      [PhoebusProperty.WIDTH]: 100,
      [PhoebusProperty.HEIGHT]: 20,
    },
  },

  // Containers

  [PhoebusWidgetType.NAVIGATION_TABS]: {
    inputDefaults: {
      [PhoebusProperty.WIDTH]: 500,
      [PhoebusProperty.HEIGHT]: 300,
    },
  },
};

/**
 * Applies `inputDefaults` from `PHOEBUS_WIDGET_DEFAULTS` for the widget type
 * into `phWidget.properties`, but only for keys that are currently absent.
 *
 * Also handles the conditional line-style default: if `line_width` is present
 * and positive but `line_style` is absent, `line_style` is set to `"SOLID"`.
 *
 * Call this once at the start of `convertWidget`, before the propMap loop.
 */
export function applyWidgetDefaults(phWidget: PhoebusWidget): void {
  const entry = PHOEBUS_WIDGET_DEFAULTS[phWidget.type];

  if (entry?.inputDefaults) {
    for (const [key, value] of Object.entries(entry.inputDefaults) as [
      PhoebusProperty,
      unknown,
    ][]) {
      if (!phWidget.properties.has(key)) {
        phWidget.properties.set(key, value);
      }
    }
  }

  // Conditional default: Phoebus renders borders as solid when line_width is
  // explicitly set but line_style is omitted.
  const lineWidth = phWidget.properties.get(PhoebusProperty.LINE_WIDTH);
  if (
    (typeof lineWidth === "number" || typeof lineWidth === "string") &&
    Number(lineWidth) > 0 &&
    !phWidget.properties.has(PhoebusProperty.LINE_STYLE)
  ) {
    phWidget.properties.set(PhoebusProperty.LINE_STYLE, "SOLID");
  }
}
