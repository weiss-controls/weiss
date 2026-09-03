// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

/**
 * Converts Phoebus widgets to WEISS .opi.json widgets.
 *
 * Converts a parsed PhoebusDisplay into an array of ConvertedWidget objects
 * ready to be JSON-serialised and saved as a .opi.json file.
 * Anything that cannot be mapped is dropped and recorded in ConversionResult.warnings.
 */

import { PhoebusBoolean, PhoebusProperty, PhoebusWidgetType, COLOR_PROP_KEYS } from "./constants";
import { PHOEBUS_WIDGET_DEFAULTS, applyWidgetDefaults } from "./defaults";
import { WIDGET_MAP } from "@src/utils/bob2json/mapping";
import type { PhoebusDisplay, PhoebusWidget } from "./types";
import type { ExportedWidget, PropertyValue } from "@src/types/widgets";
import { parseActionButton } from "./converter/actionButton";
import { centerWidgetsToOrigin } from "./converter/layout";
import { buildUnsupportedPlaceholderWidget } from "./converter/placeholders";
import {
  colorToRgba,
  extractFontProps,
  getNumericProperty,
  isTrue,
  mapEmbeddedDisplayPath,
  mapHAlign,
  mapLineStyle,
  mapNavTabs,
  mapStates,
  mapVAlign,
  normalizeTooltipMacros,
} from "./converter/valueMappers";

export interface ConversionResult {
  widgets: ExportedWidget[];
  warnings: string[];
}

/**
 * Converts a single PhoebusWidget into a ConvertedWidget.
 * Pushes human-readable warnings for anything that could not be mapped.
 */
function convertWidget(
  phWidget: PhoebusWidget,
  warnings: string[],
  xOffset = 0,
  yOffset = 0,
  forcePositionFromOffset = false,
): ExportedWidget | null {
  const entry = WIDGET_MAP[phWidget.type];
  const actionButton =
    phWidget.type === PhoebusWidgetType.ACTION_BUTTON ? parseActionButton(phWidget, warnings) : {};
  const weissName =
    phWidget.type === PhoebusWidgetType.ACTION_BUTTON && actionButton.mode === "open_display"
      ? "NavigationButton"
      : entry?.weissName;

  if (!entry) {
    warnings.push(
      `Unsupported widget type "${phWidget.type}"` +
        (phWidget.name ? ` (name: "${phWidget.name}")` : "") +
        " - replaced with placeholder.",
    );
    return buildUnsupportedPlaceholderWidget(phWidget, xOffset, yOffset, forcePositionFromOffset);
  }

  if (entry.weissName === undefined) {
    warnings.push(
      `Widget type "${phWidget.type}"` +
        (phWidget.name ? ` (name: "${phWidget.name}")` : "") +
        " is not implemented in WEISS yet - replaced with placeholder.",
    );
    return buildUnsupportedPlaceholderWidget(phWidget, xOffset, yOffset, forcePositionFromOffset);
  }

  applyWidgetDefaults(phWidget);

  const properties: Record<string, PropertyValue> = {};
  const hasRawX = phWidget.properties.has(PhoebusProperty.X);
  const hasRawY = phWidget.properties.has(PhoebusProperty.Y);

  // Font
  if (entry.hasFont) {
    const rawFont = phWidget.properties.get(PhoebusProperty.FONT);
    if (rawFont !== undefined && rawFont !== null) {
      Object.assign(properties, extractFontProps(rawFont));
    }
  }

  const transparentProp = phWidget.properties.get(PhoebusProperty.TRANSPARENT);
  const isExplicitlyOpaque = transparentProp === false || transparentProp === PhoebusBoolean.FALSE;
  const isTransparent =
    (phWidget.type === PhoebusWidgetType.LABEL && !isExplicitlyOpaque) || isTrue(transparentProp);
  const rawX = getNumericProperty(phWidget, PhoebusProperty.X, 0);
  const rawY = getNumericProperty(phWidget, PhoebusProperty.Y, 0);
  const absoluteX = rawX + xOffset;
  const absoluteY = rawY + yOffset;
  const supportsBackgroundColor = Object.values(entry.propMap).includes("backgroundColor");

  for (const [phKey, weissKeyRaw] of Object.entries(entry.propMap)) {
    if (typeof weissKeyRaw !== "string") continue;

    // Handle default values. Phoebus omits properties that match built-in defaults.
    const weissKey = weissKeyRaw;
    const phoebusKey = phKey as PhoebusProperty;
    const raw = phWidget.properties.get(phoebusKey);

    if (phoebusKey === PhoebusProperty.X) {
      if (!hasRawX && !forcePositionFromOffset) continue;
      properties[weissKey] = absoluteX;
      continue;
    }
    if (phoebusKey === PhoebusProperty.Y) {
      if (!hasRawY && !forcePositionFromOffset) continue;
      properties[weissKey] = absoluteY;
      continue;
    }
    // Skip properties still absent after defaults have been applied.
    // (width/height without defaults, truly optional properties, etc.)

    if (raw === undefined || raw === null) continue;

    // Alignment
    if (phoebusKey === PhoebusProperty.HORIZONTAL_ALIGNMENT) {
      const mapped = mapHAlign(raw);
      if (mapped !== undefined) properties[weissKey] = mapped;
      continue;
    }
    if (phoebusKey === PhoebusProperty.VERTICAL_ALIGNMENT) {
      const mapped = mapVAlign(raw);
      if (mapped !== undefined) {
        properties[weissKey] = mapped;
      } else {
        warnings.push(
          `Widget "${phWidget.name ?? phWidget.type}": ` +
            `unknown vertical alignment "${JSON.stringify(raw)}" - skipped.`,
        );
      }
      continue;
    }

    if (phoebusKey === PhoebusProperty.LINE_STYLE) {
      const mapped = mapLineStyle(raw);
      if (mapped !== undefined) {
        properties[weissKey] = mapped;
      } else {
        warnings.push(
          `Widget "${phWidget.name ?? phWidget.type}": ` +
            `unknown line style "${JSON.stringify(raw)}" - skipped.`,
        );
      }
      continue;
    }

    // Color properties
    if (COLOR_PROP_KEYS.has(phoebusKey)) {
      if (isTransparent && weissKey === "backgroundColor") {
        properties[weissKey] = "transparent";
        continue;
      }

      const rgba = colorToRgba(raw);
      if (rgba !== undefined) {
        properties[weissKey] = rgba;
      } else {
        warnings.push(
          `Widget "${phWidget.name ?? phWidget.type}": ` +
            `could not parse color for "${phoebusKey}" - skipped.`,
        );
      }
      continue;
    }

    // Multi-state LED states
    if (phoebusKey === PhoebusProperty.STATES) {
      const mappedStates = mapStates(raw);
      if (mappedStates !== undefined) {
        properties[weissKey] = mappedStates;
      } else {
        warnings.push(
          `Widget "${phWidget.name ?? phWidget.type}": ` +
            `could not parse states for "${phoebusKey}" - skipped.`,
        );
      }
      continue;
    }

    // Navigation tabs
    if (phoebusKey === PhoebusProperty.TABS) {
      const mappedTabs = mapNavTabs(raw);
      if (mappedTabs !== undefined) {
        properties[weissKey] = mappedTabs;
      } else {
        warnings.push(
          `Widget "${phWidget.name ?? phWidget.type}": ` +
            `could not parse tabs for "${phoebusKey}" - skipped.`,
        );
      }
      continue;
    }

    // Embedded display path
    if (phoebusKey === PhoebusProperty.FILE && weissKey === "displayPath") {
      const mappedPath = mapEmbeddedDisplayPath(raw);
      if (mappedPath !== undefined) {
        properties[weissKey] = mappedPath;
      }
      continue;
    }

    // Embedded display macros
    if (phoebusKey === PhoebusProperty.MACROS && weissKey === "macros") {
      properties[weissKey] = raw as Record<string, string>;
      continue;
    }

    // Tooltip macros
    if (phoebusKey === PhoebusProperty.TOOLTIP) {
      const normalized = normalizeTooltipMacros(raw);
      if (normalized !== undefined) {
        properties[weissKey] = normalized;
      }
      continue;
    }

    // Boolean
    if (
      phoebusKey === PhoebusProperty.VISIBLE ||
      phoebusKey === PhoebusProperty.ENABLED ||
      phoebusKey === PhoebusProperty.TRANSPARENT ||
      phoebusKey === PhoebusProperty.SQUARE ||
      phoebusKey === PhoebusProperty.HORIZONTAL
    ) {
      const boolValue = isTrue(raw);
      properties[weissKey] = weissKey === "disabled" ? !boolValue : boolValue;
      continue;
    }

    // Scalar pass-through
    if (typeof raw === "string" || typeof raw === "number") {
      properties[weissKey] = raw;
      continue;
    }

    warnings.push(
      `Widget "${phWidget.name ?? phWidget.type}": ` +
        `unhandled value type for property "${phoebusKey}" - skipped.`,
    );
  }

  // Nested children widgets
  const children: ExportedWidget[] = [];
  const childXOffset = phWidget.type === PhoebusWidgetType.GROUP ? absoluteX : xOffset;
  const childYOffset = phWidget.type === PhoebusWidgetType.GROUP ? absoluteY : yOffset;
  const childForcePositionFromOffset = phWidget.type === PhoebusWidgetType.GROUP;

  for (const child of phWidget.children) {
    const converted = convertWidget(
      child,
      warnings,
      childXOffset,
      childYOffset,
      childForcePositionFromOffset,
    );
    if (converted !== null) children.push(converted);
  }

  const widgetOutputDefaults = PHOEBUS_WIDGET_DEFAULTS[phWidget.type]?.outputDefaults;
  if (widgetOutputDefaults) {
    Object.assign(properties, widgetOutputDefaults);
  }

  if (phWidget.type === PhoebusWidgetType.ACTION_BUTTON) {
    if (actionButton.mode === "write_pv") {
      if (actionButton.pvName !== undefined) {
        properties.pvName = actionButton.pvName;
      }
      if (actionButton.actionValue !== undefined) {
        properties.actionValue = actionButton.actionValue;
      }
    } else if (actionButton.mode === "open_display") {
      if (actionButton.displayPath !== undefined) {
        properties.displayPath = actionButton.displayPath;
      }
      if (actionButton.macros !== undefined) {
        properties.macros = actionButton.macros;
      }
      if (actionButton.target !== undefined) {
        properties.target = actionButton.target;
      }
    }
  }

  if (isTransparent && supportsBackgroundColor && properties.backgroundColor === undefined) {
    properties.backgroundColor = "transparent";
  }

  return {
    widgetName: weissName ?? entry.weissName,
    properties: properties as ExportedWidget["properties"],
    ...(children.length > 0 && { children }),
  };
}

/**
 * Produces the mandatory __grid__ entry that WEISS expects as editorWidgets[0].
 */
function makeGridWidget(display: PhoebusDisplay): ExportedWidget {
  const properties: Record<string, PropertyValue> = {};

  if (display.macros && Object.keys(display.macros).length > 0) {
    properties.macros = display.macros;
  }

  if (display.backgroundColor !== undefined) {
    const bg = colorToRgba(display.backgroundColor);
    if (bg !== undefined) properties.backgroundColor = bg;
  }

  if (display.gridColor !== undefined) {
    const gc = colorToRgba(display.gridColor);
    if (gc !== undefined) properties.gridLineColor = gc;
  }

  if (display.gridVisible !== undefined) {
    properties.gridLineVisible = isTrue(display.gridVisible);
  }

  const gridSize = display.gridStepX ?? display.gridStepY;
  if (gridSize !== undefined) {
    properties.gridSize = gridSize;
  }

  return {
    widgetName: "GridZone",
    properties: properties as ExportedWidget["properties"],
  };
}

/**
 * Converts a parsed Phoebus display into WEISS widgets and warnings.
 */
export function convertDisplay(display: PhoebusDisplay): ConversionResult {
  const warnings: string[] = [];
  const gridWidget = makeGridWidget(display);
  const contentWidgets: ExportedWidget[] = [];
  const rootXOffset = display.x ?? 0;
  const rootYOffset = display.y ?? 0;

  for (const phWidget of display.widgets) {
    const converted = convertWidget(phWidget, warnings, rootXOffset, rootYOffset, true);
    if (converted !== null) contentWidgets.push(converted);
  }

  const widgets: ExportedWidget[] = [gridWidget, ...contentWidgets];
  centerWidgetsToOrigin(widgets, contentWidgets);

  return { widgets, warnings };
}
