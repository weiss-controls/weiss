// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

/**
 * Phoebus XML → WEISS .opi.json parser.
 *
 * Converts a parsed PhoebusDisplay into an array of ConvertedWidget objects
 * ready to be JSON-serialised and saved as a .opi.json file.
 * Anything that cannot be mapped is dropped and recorded in ConversionResult.warnings.
 */

import {
  PhoebusAttribute,
  PhoebusAlignment,
  PhoebusBoolean,
  PHOEBUS_DEFAULT_SIZES,
  PhoebusProperty,
  PhoebusWidgetType,
} from "./constants";
import { WIDGET_MAP } from "@src/utils/bob2json/mapping";
import type { PhoebusDisplay, PhoebusFont, PhoebusState, PhoebusWidget } from "./types";
import type { ExportedWidget, PropertyValue, StateEntry } from "@src/types/widgets";
import { COLORS } from "@src/constants/constants";

/* -------------------------------------------------------------------------- */
/* Output types                                                                */
/* -------------------------------------------------------------------------- */

export interface ConversionResult {
  widgets: ExportedWidget[];
  warnings: string[];
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Converts a PhoebusColor to CSS rgba(r, g, b, a).
 * Alpha defaults to 1 when omitted by Phoebus.
 * Returns undefined when the input is not a valid color object.
 */
function colorToRgba(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  const r = Number(c[PhoebusAttribute.RED]);
  const g = Number(c[PhoebusAttribute.GREEN]);
  const b = Number(c[PhoebusAttribute.BLUE]);
  if ([r, g, b].some(isNaN)) return undefined;

  const rawAlpha = c[PhoebusAttribute.ALPHA];
  const alphaNumber = rawAlpha === undefined ? 1 : Number(rawAlpha);
  if (isNaN(alphaNumber)) return undefined;

  // Phoebus alpha can be encoded either as [0,1] or [0,255].
  const normalizedAlpha = alphaNumber > 1 ? alphaNumber / 255 : alphaNumber;
  const clampedAlpha = Math.max(0, Math.min(1, normalizedAlpha));
  const clampedR = Math.max(0, Math.min(255, r));
  const clampedG = Math.max(0, Math.min(255, g));
  const clampedB = Math.max(0, Math.min(255, b));

  return `rgba(${clampedR}, ${clampedG}, ${clampedB}, ${clampedAlpha})`;
}

/**
 * Converts a Phoebus horizontal alignment value to the WEISS equivalent.
 * WEISS uses lowercase "left" | "center" | "right".
 */
function mapHAlign(raw: unknown): string | undefined {
  if (typeof raw === "number") {
    switch (raw) {
      case 0:
        return "left";
      case 1:
        return "center";
      case 2:
        return "right";
      default:
        return undefined;
    }
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    const asNumber = Number(trimmed);
    if (!isNaN(asNumber)) return mapHAlign(asNumber);

    const normalized = trimmed.toUpperCase();
    if (normalized === "LEFT") return "left";
    if (normalized === "CENTER" || normalized === "CENTRE") return "center";
    if (normalized === "RIGHT") return "right";
  }

  switch (raw) {
    case PhoebusAlignment.LEFT:
      return "left";
    case PhoebusAlignment.CENTRE:
      return "center";
    case PhoebusAlignment.RIGHT:
      return "right";
    default:
      return "left";
  }
}

/**
 * Converts a Phoebus vertical alignment value to the WEISS equivalent.
 * WEISS uses lowercase "top" | "middle" | "bottom".
 */
function mapVAlign(raw: unknown): string | undefined {
  if (typeof raw === "number") {
    switch (raw) {
      case 0:
        return "top";
      case 1:
        return "middle";
      case 2:
        return "bottom";
      default:
        return "middle";
    }
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    const asNumber = Number(trimmed);
    if (!isNaN(asNumber)) return mapVAlign(asNumber);

    const normalized = trimmed.toUpperCase();
    if (normalized === "TOP") return "top";
    if (normalized === "MIDDLE" || normalized === "CENTER" || normalized === "CENTRE") {
      return "middle";
    }
    if (normalized === "BOTTOM") return "bottom";
  }

  switch (raw) {
    case PhoebusAlignment.TOP:
      return "top";
    case PhoebusAlignment.MIDDLE:
      return "middle";
    case PhoebusAlignment.CENTRE:
      return "middle";
    case PhoebusAlignment.BOTTOM:
      return "bottom";
    default:
      return "middle";
  }
}

function mapLineStyle(raw: unknown): string | undefined {
  console.log("mapLineStyle called with raw:", raw);
  if (typeof raw === "string") {
    const normalized = raw.trim().toUpperCase();
    switch (normalized) {
      case "SOLID":
        return "solid";
      case "DASH":
        return "dashed";
      case "DOT":
        return "dotted";
      case "DASHDOT":
        return "dashed"; // fallback
      case "DASHDOTDOT":
        return "dashed"; // fallback
      default:
        return "none";
    }
  }
  if (typeof raw === "number") {
    switch (raw) {
      case 0:
        return "solid";
      case 1:
        return "dashed";
      case 2:
        return "dotted";
      case 3:
        return "dashed"; // fallback
      case 4:
        return "dashed"; // fallback
      default:
        return "none";
    }
  }
  return "none";
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
  if (f.family) {
    const familyStr = String(f.family).trim().toLowerCase();
    if (familyStr.includes("monospace")) out.fontFamily = "monospace";
    else if (familyStr.includes("sans")) out.fontFamily = "sans-serif";
    else if (familyStr.includes("serif")) out.fontFamily = "serif";
    else if (familyStr.includes("fantasy")) out.fontFamily = "fantasy";
    else if (familyStr.includes("cursive")) out.fontFamily = "cursive";
    else out.fontFamily = "serif";
  }
  if (f.size !== undefined) out.fontSize = f.size;
  if (f.bold !== undefined) out.fontBold = f.bold;
  if (f.italic !== undefined) out.fontItalic = f.italic;
  return out;
}

/** Returns true when the Phoebus property value represents a boolean true. */
function isTrue(raw: unknown): boolean {
  return raw === true || raw === PhoebusBoolean.TRUE || raw === 1;
}

/**
 * Phoebus labels are transparent by default even when the tag is omitted.
 * For other widgets, omission means false unless explicitly set.
 */
function isTransparentWidget(phWidget: PhoebusWidget): boolean {
  const rawTransparent = phWidget.properties.get(PhoebusProperty.TRANSPARENT);
  if (rawTransparent === undefined || rawTransparent === null) {
    return phWidget.type === PhoebusWidgetType.LABEL;
  }
  return isTrue(rawTransparent);
}

/** Converts parsed Phoebus states to WEISS stateList entries. */
function mapStates(raw: unknown): StateEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const states = raw as PhoebusState[];
  const mapped = states
    .map((state): StateEntry | null => {
      const color = colorToRgba(state.color);
      if (color === undefined) return null;

      return {
        value: String(state.value),
        color,
        label: state.label ?? "",
      };
    })
    .filter((state): state is StateEntry => state !== null);

  return mapped.length > 0 ? mapped : undefined;
}

/** Converts Phoebus embedded display file extension to WEISS display extension. */
function mapEmbeddedDisplayPath(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  return raw.replace(/\.bob$/i, ".opi.json");
}

/* -------------------------------------------------------------------------- */
/* Color property keys — these need hex transformation instead of a raw copy  */
/* -------------------------------------------------------------------------- */

const COLOR_PROP_KEYS = new Set<PhoebusProperty>([
  PhoebusProperty.BACKGROUND_COLOR,
  PhoebusProperty.FOREGROUND_COLOR,
  PhoebusProperty.BORDER_COLOR,
  PhoebusProperty.ON_COLOR,
  PhoebusProperty.OFF_COLOR,
  PhoebusProperty.LINE_COLOR,
]);

/** Reads a numeric property from a Phoebus widget, accepting numeric strings too. */
function getNumericProperty(
  phWidget: PhoebusWidget,
  key: PhoebusProperty,
  fallback: number,
): number {
  const raw = phWidget.properties.get(key);
  if (typeof raw === "number" && isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** Builds a visible square placeholder for unsupported Phoebus widgets. */
function buildUnsupportedPlaceholderWidget(
  phWidget: PhoebusWidget,
  xOffset: number,
  yOffset: number,
  forcePositionFromOffset = false,
): ExportedWidget {
  const hasRawX = phWidget.properties.has(PhoebusProperty.X);
  const hasRawY = phWidget.properties.has(PhoebusProperty.Y);
  const x = hasRawX
    ? getNumericProperty(phWidget, PhoebusProperty.X, 100) + xOffset
    : forcePositionFromOffset
      ? xOffset
      : 100 + xOffset;
  const y = hasRawY
    ? getNumericProperty(phWidget, PhoebusProperty.Y, 100) + yOffset
    : forcePositionFromOffset
      ? yOffset
      : 100 + yOffset;
  const width = getNumericProperty(phWidget, PhoebusProperty.WIDTH, 100);
  const height = getNumericProperty(phWidget, PhoebusProperty.HEIGHT, 100);
  const tooltip = `Unsupported Phoebus widget: ${phWidget.type}`;

  return {
    widgetName: "TextLabel",
    properties: {
      x: x,
      y: y,
      width: width,
      height: height,
      label: "Unsupported Phoebus Widget",
      textHAlign: "center",
      textVAlign: "middle",
      backgroundColor: "transparent",
      borderStyle: "dashed",
      borderWidth: 1,
      fontSize: 12,
      textColor: COLORS.textColor,
      tooltip,
    } as ExportedWidget["properties"],
  };
}

/* -------------------------------------------------------------------------- */
/* Core conversion                                                             */
/* -------------------------------------------------------------------------- */

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

  if (!entry) {
    warnings.push(
      `Unsupported widget type "${phWidget.type}"` +
        (phWidget.name ? ` (name: "${phWidget.name}")` : "") +
        " — replaced with placeholder.",
    );
    return buildUnsupportedPlaceholderWidget(phWidget, xOffset, yOffset, forcePositionFromOffset);
  }

  if (entry.weissName === "NotImplemented") {
    warnings.push(
      `Widget type "${phWidget.type}"` +
        (phWidget.name ? ` (name: "${phWidget.name}")` : "") +
        " is not implemented in WEISS yet — replaced with placeholder.",
    );
    return buildUnsupportedPlaceholderWidget(phWidget, xOffset, yOffset, forcePositionFromOffset);
  }

  const properties: Record<string, PropertyValue> = {};
  const hasRawX = phWidget.properties.has(PhoebusProperty.X);
  const hasRawY = phWidget.properties.has(PhoebusProperty.Y);

  /* ── Font ───────────────────────────────────────────────────────────────────── */
  if (entry.hasFont) {
    const rawFont = phWidget.properties.get(PhoebusProperty.FONT);
    if (rawFont !== undefined && rawFont !== null) {
      Object.assign(properties, extractFontProps(rawFont));
    }
  }

  const isTransparent = isTransparentWidget(phWidget);
  const rawX = getNumericProperty(phWidget, PhoebusProperty.X, 0);
  const rawY = getNumericProperty(phWidget, PhoebusProperty.Y, 0);
  const absoluteX = rawX + xOffset;
  const absoluteY = rawY + yOffset;
  const defaultSize = PHOEBUS_DEFAULT_SIZES[phWidget.type];
  const supportsBackgroundColor = Object.values(entry.propMap).includes("backgroundColor");
  // Line style and width handling: if a line width is specified but no style, default to solid (Phoebus default).
  const lineWidth = getNumericProperty(phWidget, PhoebusProperty.LINE_WIDTH, 0);
  const hasLineStyle = phWidget.properties.has(PhoebusProperty.LINE_STYLE);
  if (lineWidth > 0 && !hasLineStyle) {
    phWidget.properties.set(PhoebusProperty.LINE_STYLE, "SOLID");
  }

  for (const [phKey, weissKeyRaw] of Object.entries(entry.propMap)) {
    if (typeof weissKeyRaw !== "string") continue;

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
    if (phoebusKey === PhoebusProperty.WIDTH || phoebusKey === PhoebusProperty.HEIGHT) {
      if (raw === undefined || raw === null) {
        const fallback =
          phoebusKey === PhoebusProperty.WIDTH ? defaultSize?.width : defaultSize?.height;
        if (fallback !== undefined) {
          properties[weissKey] = fallback;
        }
        continue;
      }
    }

    if (raw === undefined || raw === null) continue;

    /* ── Alignment enums ─────────────────────────────────────────────── */
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
            `unknown vertical alignment "${JSON.stringify(raw)}" — skipped.`,
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
            `unknown line style "${JSON.stringify(raw)}" — skipped.`,
        );
      }
      continue;
    }

    /* ── Color properties ────────────────────────────────────────────── */
    if (COLOR_PROP_KEYS.has(phoebusKey)) {
      // Phoebus transparent semantics are about widget background transparency,
      // not text/line colors. Keep non-background colors intact.
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
            `could not parse color for "${phoebusKey}" — skipped.`,
        );
      }
      continue;
    }

    /* ── Multi-state LED states ─────────────────────────────────────── */
    if (phoebusKey === PhoebusProperty.STATES) {
      const mappedStates = mapStates(raw);
      if (mappedStates !== undefined) {
        properties[weissKey] = mappedStates;
      } else {
        warnings.push(
          `Widget "${phWidget.name ?? phWidget.type}": ` +
            `could not parse states for "${phoebusKey}" — skipped.`,
        );
      }
      continue;
    }

    /* ── Embedded display path ──────────────────────────────────────── */
    if (phoebusKey === PhoebusProperty.FILE && weissKey === "displayPath") {
      const mappedPath = mapEmbeddedDisplayPath(raw);
      if (mappedPath !== undefined) {
        properties[weissKey] = mappedPath;
      }
      continue;
    }

    /* ── Embedded display macros ──────────────────────────────────────── */
    if (phoebusKey === PhoebusProperty.MACROS && weissKey === "macros") {
      properties[weissKey] = raw as Record<string, string>;
      continue;
    }

    /* ── Boolean ─────────────────────────────────────────────────────── */
    if (
      phoebusKey === PhoebusProperty.VISIBLE ||
      phoebusKey === PhoebusProperty.ENABLED ||
      phoebusKey === PhoebusProperty.TRANSPARENT ||
      phoebusKey === PhoebusProperty.SQUARE
    ) {
      const boolValue = isTrue(raw);
      properties[weissKey] = weissKey === "disabled" ? !boolValue : boolValue;
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

  if (phWidget.type === PhoebusWidgetType.LED && entry.weissName === "BitIndicator") {
    properties.fixedProportion = false;
  }

  if (isTransparent && supportsBackgroundColor && properties.backgroundColor === undefined) {
    properties.backgroundColor = "transparent";
  }

  return {
    widgetName: entry.weissName,
    properties: properties as ExportedWidget["properties"],
    ...(children.length > 0 && { children }),
  };
}

/* -------------------------------------------------------------------------- */
/* Grid zone                                                                   */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Converts a fully-parsed PhoebusDisplay into a WEISS .opi.json-compatible
 * ConvertedWidget array, with a ConversionResult wrapper that exposes warnings.
 *
 * Usage:
 *   const { widgets, warnings } = convertDisplay(phoebusDisplay);
 *   const json = JSON.stringify(widgets, null, 2);
 */
export function convertDisplay(display: PhoebusDisplay): ConversionResult {
  const warnings: string[] = [];
  const widgets: ExportedWidget[] = [makeGridWidget(display)];
  const rootXOffset = display.x ?? 0;
  const rootYOffset = display.y ?? 0;

  for (const phWidget of display.widgets) {
    const converted = convertWidget(phWidget, warnings, rootXOffset, rootYOffset, true);
    if (converted !== null) widgets.push(converted);
  }

  return { widgets, warnings };
}
