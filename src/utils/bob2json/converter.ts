// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WEISS Contributors

/**
 * Phoebus XML → WEISS .opi.json parser.
 *
 * Converts a parsed PhoebusDisplay into an array of ExportedWidget objects
 * ready to be JSON-serialised and saved as a .opi.json file.
 *
 * Conversion stages per widget:
 *   1. Widget type → WEISS widgetName  (via WIDGET_MAP)
 *   2. Scalar properties               (via propMap, direct value copy)
 *   3. Color properties                (PhoebusColor → CSS hex string)
 *   4. Font property                   (PhoebusFont → individual TEXT_PROPS keys)
 *   5. Alignment enums                 (Phoebus LEFT/CENTER/RIGHT → WEISS equivalents)
 *   6. Children                        (recursive, for GROUP and TABS)
 *
 * Anything that cannot be mapped is dropped and recorded in ConversionResult.warnings.
 */

import { v4 as uuidv4 } from "uuid";
import {
  PhoebusAttribute,
  PhoebusAlignment,
  PhoebusBoolean,
  PhoebusProperty,
  PhoebusWidgetType,
} from "./constants";
import { WIDGET_MAP } from "./mapping";
import type { PhoebusDisplay, PhoebusWidget } from "./types";

/* -------------------------------------------------------------------------- */
/* Output types                                                                */
/* -------------------------------------------------------------------------- */

/** Scalar property value as stored in .opi.json */
type PropertyValue = string | number | boolean | string[] | Record<string, string>;

/** Mirrors the ExportedWidget shape used throughout WEISS */
export interface ExportedWidget {
  id: string;
  widgetName: string;
  properties: Record<string, PropertyValue>;
  children?: ExportedWidget[];
}

export interface ConversionResult {
  widgets: ExportedWidget[];
  warnings: string[];
}

/* -------------------------------------------------------------------------- */
/* Internal color / font types (parsed from PhoebusWidget.properties)         */
/* -------------------------------------------------------------------------- */

interface PhoebusColor {
  r: number;
  g: number;
  b: number;
}

interface PhoebusFont {
  family?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Converts a PhoebusColor to a CSS hex string (#rrggbb).
 * Returns undefined when the input is not a valid color object.
 */
function colorToHex(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  const r = Number(c[PhoebusAttribute.RED]);
  const g = Number(c[PhoebusAttribute.GREEN]);
  const b = Number(c[PhoebusAttribute.BLUE]);
  if ([r, g, b].some(isNaN)) return undefined;
  return (
    "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")
  );
}

/**
 * Converts a Phoebus horizontal alignment value to the WEISS equivalent.
 * WEISS uses lowercase "left" | "center" | "right".
 */
function mapHAlign(raw: unknown): string | undefined {
  switch (raw) {
    case PhoebusAlignment.LEFT:
      return "left";
    case PhoebusAlignment.CENTRE:
      return "center";
    case PhoebusAlignment.RIGHT:
      return "right";
    default:
      return undefined;
  }
}

/**
 * Converts a Phoebus vertical alignment value to the WEISS equivalent.
 * WEISS uses lowercase "top" | "middle" | "bottom".
 */
function mapVAlign(raw: unknown): string | undefined {
  switch (raw) {
    case PhoebusAlignment.TOP:
      return "top";
    case PhoebusAlignment.BOTTOM:
      return "bottom";
    default:
      return "middle"; // Phoebus CENTRE maps to WEISS middle
  }
}

/**
 * Extracts scalar TEXT_PROPS from a Phoebus <font> property value.
 * Phoebus font is a structured object; WEISS stores each aspect separately.
 *
 * Expected raw shape (after XML parse):
 *   { family?: string, size?: number, style?: "BOLD" | "ITALIC" | "BOLD_ITALIC" | "REGULAR" }
 */
function extractFontProps(raw: unknown): Record<string, PropertyValue> {
  if (!raw || typeof raw !== "object") return {};
  const f = raw as PhoebusFont;
  const out: Record<string, PropertyValue> = {};
  if (f.family) out.fontFamily = f.family;
  if (f.size !== undefined) out.fontSize = f.size;
  if (f.bold !== undefined) out.fontBold = f.bold;
  if (f.italic !== undefined) out.fontItalic = f.italic;
  return out;
}

/** Returns true when the Phoebus property value represents a boolean true. */
function isTrue(raw: unknown): boolean {
  return raw === true || raw === PhoebusBoolean.TRUE || raw === 1;
}

/* -------------------------------------------------------------------------- */
/* Color property keys — these need hex transformation instead of a raw copy  */
/* -------------------------------------------------------------------------- */

const COLOR_PROP_KEYS = new Set<PhoebusProperty>([
  PhoebusProperty.BACKGROUND_COLOR,
  PhoebusProperty.FOREGROUND_COLOR,
  PhoebusProperty.BORDER_COLOR,
]);

/* -------------------------------------------------------------------------- */
/* Core conversion                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Converts a single PhoebusWidget into an ExportedWidget.
 * Pushes human-readable warnings for anything that could not be mapped.
 */
function convertWidget(phWidget: PhoebusWidget, warnings: string[]): ExportedWidget | null {
  const entry = WIDGET_MAP[phWidget.type];

  if (!entry) {
    warnings.push(
      `Unsupported widget type "${phWidget.type}"` +
        (phWidget.name ? ` (name: "${phWidget.name}")` : "") +
        " — skipped.",
    );
    return null;
  }

  const properties: Record<string, PropertyValue> = {};

  for (const [phKey, weissKey] of Object.entries(entry.propMap)) {
    const phoebusKey = phKey as PhoebusProperty;
    const raw = phWidget.properties.get(phoebusKey);
    if (raw === undefined || raw === null) continue;

    /* ── Alignment enums ─────────────────────────────────────────────── */
    if (phoebusKey === PhoebusProperty.HORIZONTAL_ALIGNMENT) {
      const mapped = mapHAlign(raw);
      if (mapped !== undefined) properties[weissKey] = mapped;
      continue;
    }
    if (phoebusKey === PhoebusProperty.VERTICAL_ALIGNMENT) {
      const mapped = mapVAlign(raw);
      if (mapped !== undefined) properties[weissKey] = mapped;
      continue;
    }

    /* ── Color properties ────────────────────────────────────────────── */
    if (COLOR_PROP_KEYS.has(phoebusKey)) {
      const hex = colorToHex(raw);
      if (hex !== undefined) {
        properties[weissKey] = hex;
      } else {
        warnings.push(
          `Widget "${phWidget.name ?? phWidget.type}": ` +
            `could not parse color for "${phoebusKey}" — skipped.`,
        );
      }
      continue;
    }

    /* ── Font ────────────────────────────────────────────────────────── */
    if (phoebusKey === PhoebusProperty.FONT) {
      const fontProps = extractFontProps(raw);
      Object.assign(properties, fontProps);
      continue;
    }

    /* ── Boolean ─────────────────────────────────────────────────────── */
    if (
      phoebusKey === PhoebusProperty.VISIBLE ||
      phoebusKey === PhoebusProperty.ENABLED ||
      phoebusKey === PhoebusProperty.TRANSPARENT
    ) {
      properties[weissKey] = isTrue(raw);
      continue;
    }

    /* ── Scalar pass-through (string / number) ───────────────────────── */
    if (typeof raw === "string" || typeof raw === "number") {
      properties[weissKey] = raw;
      continue;
    }

    warnings.push(
      `Widget "${phWidget.name ?? phWidget.type}": ` +
        `unhandled value type for property "${phoebusKey}" — skipped.`,
    );
  }

  /* ── Children (GROUP, TABS) ──────────────────────────────────────────── */
  const children: ExportedWidget[] = [];
  for (const child of phWidget.children) {
    const converted = convertWidget(child, warnings);
    if (converted !== null) children.push(converted);
  }

  return {
    id: phWidget.id ?? uuidv4(),
    widgetName: entry.weissName,
    properties,
    ...(children.length > 0 && { children }),
  };
}

/* -------------------------------------------------------------------------- */
/* Grid zone                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Produces the mandatory __grid__ entry that WEISS expects as editorWidgets[0].
 * Width and height come from the <display> root element.
 */
function makeGridWidget(display: PhoebusDisplay): ExportedWidget {
  return {
    id: "__grid__",
    widgetName: "GridZone",
    properties: {
      width: display.width ?? 1920,
      height: display.height ?? 1080,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Converts a fully-parsed PhoebusDisplay into a WEISS .opi.json-compatible
 * ExportedWidget array, with a ConversionResult wrapper that exposes warnings.
 *
 * Usage:
 *   const { widgets, warnings } = convertDisplay(phoebusDisplay);
 *   const json = JSON.stringify(widgets, null, 2);
 */
export function convertDisplay(display: PhoebusDisplay): ConversionResult {
  const warnings: string[] = [];
  const widgets: ExportedWidget[] = [makeGridWidget(display)];

  for (const phWidget of display.widgets) {
    const converted = convertWidget(phWidget, warnings);
    if (converted !== null) widgets.push(converted);
  }

  return { widgets, warnings };
}
